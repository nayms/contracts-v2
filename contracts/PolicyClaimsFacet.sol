pragma solidity >=0.6.7;

import "./base/SafeMath.sol";
import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyClaimsFacet.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Policy claims
 */
contract PolicyClaimsFacet is EternalStorage, Controller, IDiamondFacet, IPolicyClaimsFacet, PolicyFacetBase {
  using SafeMath for uint;

  modifier assertActiveState () {
    require(dataUint256["state"] == POLICY_STATE_ACTIVE, 'must be in active state');
    _;
  }

  modifier assertIsClientManager (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_CLIENT_MANAGERS), 'must be client manager');
    _;
  }

  modifier assertIsAssetManager (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_ASSET_MANAGERS), 'must be asset manager');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyClaimsFacet.makeClaim.selector,
      IPolicyClaimsFacet.approveClaim.selector,
      IPolicyClaimsFacet.declineClaim.selector,
      IPolicyClaimsFacet.payClaims.selector,
      IPolicyClaimsFacet.getClaimStats.selector,
      IPolicyClaimsFacet.getClaimInfo.selector
    );
  }

  // IPolicyClaimsFacet

  function getClaimStats() public view override returns (
    uint256 numClaims_,
    uint256 numPendingClaims_
  ) {
    numClaims_ = dataUint256["claimsCount"];
    numPendingClaims_ = dataUint256["claimsPendingCount"];
  }

  function getClaimInfo (uint256 _claimIndex) public view override returns (
    uint256 amount_,
    uint256 tranchIndex_,
    bool approved_,
    bool declined_,
    bool paid_
  ) {
    amount_ = dataUint256[__i(_claimIndex, "claimAmount")];
    tranchIndex_ = dataUint256[__i(_claimIndex, "claimTranch")];
    approved_ = dataBool[__i(_claimIndex, "claimApproved")];
    declined_ = dataBool[__i(_claimIndex, "claimDeclined")];
    paid_ = dataBool[__i(_claimIndex, "claimPaid")];
  }

  function makeClaim(uint256 _index, address _clientManagerEntity, uint256 _amount) public override
    assertActiveState
    assertIsClientManager(msg.sender)
  {
    IPolicyCoreFacet(address(this)).checkAndUpdateState();
    _makeClaim(_index, _clientManagerEntity, _amount);
  }

  function approveClaim(uint256 _claimIndex)
    public
    override
    assertIsAssetManager(msg.sender)
  {
    // check claim
    require(0 < dataUint256[__i(_claimIndex, "claimAmount")], 'invalid claim');
    require(!dataBool[__i(_claimIndex, "claimApproved")], 'already approved');
    require(!dataBool[__i(_claimIndex, "claimDeclined")], 'already declined');

    // mark claim as approved
    dataBool[__i(_claimIndex, "claimApproved")] = true;
    dataUint256["claimsPendingCount"] -= 1;

    // remove from tranch balance
    uint256 claimAmount = dataUint256[__i(_claimIndex, "claimAmount")];
    uint256 claimTranch = dataUint256[__i(_claimIndex, "claimTranch")];

    dataUint256[__i(claimTranch, "balance")] = dataUint256[__i(claimTranch, "balance")].sub(claimAmount);

    emit ClaimApproved(_claimIndex, msg.sender);
  }


  function declineClaim(uint256 _claimIndex)
    public
    override
    assertIsAssetManager(msg.sender)
  {
    // check claim
    require(0 < dataUint256[__i(_claimIndex, "claimAmount")], 'invalid claim');
    require(!dataBool[__i(_claimIndex, "claimApproved")], 'already approved');
    require(!dataBool[__i(_claimIndex, "claimDeclined")], 'already declined');

    // mark claim as declined
    dataBool[__i(_claimIndex, "claimDeclined")] = true;
    dataUint256["claimsPendingCount"] -= 1;

    emit ClaimDeclined(_claimIndex, msg.sender);
  }



  function payClaims() public override {
    IERC20 tkn = IERC20(dataAddress["unit"]);

    for (uint256 i = 0; i < dataUint256["claimsCount"]; i += 1) {
      bool claimApproved = dataBool[__i(i, "claimApproved")];
      bool claimPaid = dataBool[__i(i, "claimPaid")];

      if (claimApproved && !claimPaid) {
        tkn.transfer(dataAddress[__i(i, "claimEntity")], dataUint256[__i(i, "claimAmount")]);
        dataBool[__i(i, "claimPaid")] = true;
      }
    }

    emit PaidClaims(msg.sender);
  }

  // Internal methods

  function _makeClaim(uint256 _index, address _clientManagerEntity, uint256 _amount) private
    assertActiveState
    assertIsClientManager(msg.sender)
  {
    // check client manager entity
    bytes32 clientManagerEntityContext = AccessControl(_clientManagerEntity).aclContext();
    require(acl().userSomeHasRoleInContext(clientManagerEntityContext, msg.sender), 'must have role in client manager entity');

    // check that tranch is active
    require(dataUint256[__i(_index, "state")] == TRANCH_STATE_ACTIVE, 'tranch must be active');

    // check amount
    require(
      _getTranchPendingClaimsAmount(_index).add(_amount) <= dataUint256[string(abi.encodePacked(_index, "balance"))],
      'claim too high'
    );

    uint256 claimIndex = dataUint256["claimsCount"];
    dataUint256[__i(claimIndex, "claimAmount")] = _amount;
    dataUint256[__i(claimIndex, "claimTranch")] = _index;
    dataAddress[__i(claimIndex, "claimEntity")] = _clientManagerEntity;

    dataUint256["claimsCount"] = claimIndex + 1;
    dataUint256["claimsPendingCount"] += 1;

    emit NewClaim(_index, claimIndex, msg.sender);
  }

  function _getTranchPendingClaimsAmount (uint256 _index) private view returns (uint256) {
    uint256 amount;

    for (uint256 i = 0; i < dataUint256["claimsCount"]; i += 1) {
      bool isApproved = dataBool[__i(i, "claimApproved")];
      bool isDeclined = dataBool[__i(i, "claimDeclined")];
      uint256 tranchNum = dataUint256[__i(i, "claimTranch")];

      if (tranchNum == _index && !isApproved && !isDeclined) {
        amount = amount.add(dataUint256[__i(i, "claimAmount")]);
      }
    }

    return amount;
  }
}

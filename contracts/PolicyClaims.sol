pragma solidity >=0.6.7;

import "./base/SafeMath.sol";
import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IPolicyClaims.sol";
import "./base/IPolicyStates.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Policy claims
 */
contract PolicyClaims is EternalStorage, Controller, IPolicyClaims, IPolicyStates {
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

  function makeClaim(uint256 _index, address _clientManagerEntity, uint256 _amount) public override
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

pragma solidity >=0.5.8;

import "./base/Address.sol";
import "./base/SafeMath.sol";
import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IPolicyMutations.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Policy
 */
contract PolicyMutations is EternalStorage, Controller, IPolicyMutations {
  using SafeMath for uint;
  using Address for address;

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

  function makeClaim(uint256 _index, address _clientManagerEntity, uint256 _amount) public
    assertIsClientManager(msg.sender)
  {
    require(1 > 2, 'bad code');

    // check client manager entity
    bytes32 clientManagerEntityContext = AccessControl(_clientManagerEntity).aclContext();
    require(acl().userSomeHasRoleInContext(clientManagerEntityContext, msg.sender), 'must have role in client manager entity');

    // check amount
    require(
      _getTranchUnapprovedClaimsAmount(_index).add(_amount) <= dataUint256[string(abi.encodePacked(_index, "balance"))],
      'claim too high'
    );

    uint256 claimIndex = dataUint256["claimsCount"];
    dataUint256[string(abi.encodePacked("claimAmount", claimIndex))] = _amount;
    dataUint256[string(abi.encodePacked("claimTranch", claimIndex))] = _index;
    dataAddress[string(abi.encodePacked("claimEntity", claimIndex))] = _clientManagerEntity;

    dataUint256["claimsCount"] = claimIndex + 1;
    dataUint256["claimsUnapprovedCount"] += 1;
  }

  function approveClaim(uint256 _claimIndex)
    public
    assertIsAssetManager(msg.sender)
  {
    // if claim already settled then it's invalid
    require(!dataBool[__i(_claimIndex, "claimApproved")], 'invalid claim');

    // mark claim as approved
    dataBool[__i(_claimIndex, "claimApproved")] = true;
    dataUint256["claimsUnapprovedCount"] -= 1;

    // remove from tranch balance and tranch unapproved claim balance
    uint256 claimAmount = dataUint256[__i(_claimIndex, "claimAmount")];
    uint256 claimTranch = dataUint256[__i(_claimIndex, "claimTranch")];

    dataUint256[__i(claimTranch, "balance")] = dataUint256[__i(claimTranch, "balance")].sub(claimAmount);
    dataUint256[__i(claimTranch, "claimsUnapprovedBalance")] = dataUint256[__i(claimTranch, "claimsUnapprovedBalance")].sub(claimAmount);
  }


  function payClaims() public {
    IERC20 tkn = IERC20(dataAddress["unit"]);

    for (uint256 i = 0; i < dataUint256["claimsCount"]; i += 1) {
      tkn.transfer(dataAddress[__i(i, "claimEntity")], dataUint256[__i(i, "claimAmount")]);
      dataBool[__i(i, "claimPaid")] = true;
    }
  }

  // Internal methods

  function _getTranchUnapprovedClaimsAmount (uint256 _index) private view returns (uint256) {
    uint256 amount;

    for (uint256 i = 0; i < dataUint256["claimsCount"]; i += 1) {
      bool isApproved = dataBool[__i(i, "claimApproved")];
      bool isPaid = dataBool[__i(i, "claimPaid")];
      uint256 tranchNum = dataUint256[__i(i, "claimTranch")];

      if (tranchNum == _index && !isPaid && !isApproved) {
        amount = amount.add(dataUint256[__i(i, "claimAmount")]);
      }
    }

    return amount;
  }
}

pragma solidity >=0.5.8;

import "./EternalStorage.sol";
import "./IACL.sol";

contract AccessControl is EternalStorage {
  // keccak256("roleAssetManager");
  bytes32 constant public ROLE_ASSET_MANAGER = 0x15fe38e1f43516cc4ffb9ea5c938aa92b47ad6c3630aa8f3ab30adefc9305ee9;
  // keccak256("roleClientManager");
  bytes32 constant public ROLE_CLIENT_MANAGER = 0xe6633b919e32633b20851f7ea00f45dc49a8d19e72c7ef293713007df9d9844c;

  constructor (address _acl, string memory _aclContext) public {
    dataAddress["acl"] = _acl;
    dataString["aclContext"] = _aclContext;
  }

  modifier assertIsAdmin () {
    require(acl().isAdmin(msg.sender), 'unauthorized - must be admin');
    _;
  }

  modifier assertCanCreatePolicyTranches () {
    require(isAssetManagerAgent(msg.sender), 'unauthorized');
    _;
  }

  modifier assertCanStartTranchSale () {
    require(isAssetManagerAgent(msg.sender), 'unauthorized');
    _;
  }

  modifier assertCanUpdatePolicyDetails () {
    require(isAssetManagerAgent(msg.sender), 'unauthorized');
    _;
  }

  function isAssetManager(address _addr) view public returns (bool) {
    return acl().hasRole(dataString["aclContext"], _addr, ROLE_ASSET_MANAGER);
  }

  function isClientManager(address _addr) view public returns (bool) {
    return acl().hasRole(dataString["aclContext"], _addr, ROLE_CLIENT_MANAGER);
  }

  function acl () view internal returns (IACL) {
    return IACL(dataAddress["acl"]);
  }
}

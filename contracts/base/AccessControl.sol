pragma solidity >=0.5.8;

import "./EternalStorage.sol";
import "./IACL.sol";

contract AccessControl is EternalStorage {
  // keccak256("roleAssetManager");
  bytes32 constant public ROLE_ASSET_MANAGER = 0x15fe38e1f43516cc4ffb9ea5c938aa92b47ad6c3630aa8f3ab30adefc9305ee9;
  // keccak256("roleAssetManagerAgent");
  bytes32 constant public ROLE_ASSET_MANAGER_AGENT = 0xbd149c6de4c03e1f89a2686aca0f1246824385f84bf13a9d83ddbda77d794895;
  // keccak256("roleClientManager");
  bytes32 constant public ROLE_CLIENT_MANAGER = 0xe6633b919e32633b20851f7ea00f45dc49a8d19e72c7ef293713007df9d9844c;
  // keccak256("roleClientManagerAgent");
  bytes32 constant public ROLE_CLIENT_MANAGER_AGENT = 0x51efd9fc82afcfdcb593b60c58ef50169227ee554bbb316f53d2511d279f3bfe;

  constructor (address _acl, string memory _aclContext) public {
    dataAddress["acl"] = _acl;
    dataString["aclContext"] = _aclContext;
  }

  modifier assertIsAdmin () {
    require(acl().isAdmin(msg.sender), 'unauthorized - must be admin');
    _;
  }

  modifier assertIsAssetManagerAgent () {
    require(isAssetManagerAgent(msg.sender), 'unauthorized - must be asset mgr agent');
    _;
  }

  function isAssetManager(address _addr) view public returns (bool) {
    return acl().hasRole(dataString["aclContext"], _addr, ROLE_ASSET_MANAGER);
  }

  function isAssetManagerAgent(address _addr) view public returns (bool) {
    bytes32[] memory r = new bytes32[](2);
    r[0] = ROLE_ASSET_MANAGER_AGENT;
    r[1] = ROLE_ASSET_MANAGER;
    return acl().hasAnyRole(dataString["aclContext"], _addr, r);
  }

  function isClientManager(address _addr) view public returns (bool) {
    return acl().hasRole(dataString["aclContext"], _addr, ROLE_CLIENT_MANAGER);
  }

  function isClientManagerAgent(address _addr) view public returns (bool) {
    bytes32[] memory r = new bytes32[](2);
    r[0] = ROLE_CLIENT_MANAGER_AGENT;
    r[1] = ROLE_CLIENT_MANAGER;
    return acl().hasAnyRole(dataString["aclContext"], _addr, r);
  }

  function acl () view internal returns (IACL) {
    return IACL(dataAddress["acl"]);
  }
}

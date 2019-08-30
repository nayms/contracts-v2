pragma solidity >=0.5.8;

import "./EternalStorage.sol";
import "./IACL.sol";

contract AccessControl is EternalStorage {
  constructor (address _acl, string memory _aclContext) public {
    dataAddress["acl"] = _acl;
    dataString["aclContext"] = _aclContext;
    dataBytes32["roleAssetManager"] = keccak256("roleAssetManager");
    dataBytes32["roleAssetManagerAgent"] = keccak256("roleAssetManagerAgent");
    dataBytes32["roleClientManager"] = keccak256("roleClientManager");
    dataBytes32["roleClientManagerAgent"] = keccak256("roleClientManagerAgent");
  }

  modifier assertIsAdmin () {
    require(acl().isAdmin(msg.sender), 'unauthorized - must be admin');
    _;
  }

  modifier assertIsAssetManager () {
    require(isAssetManager(msg.sender), 'unauthorized - must be asset mgr');
    _;
  }

  modifier assertIsAssetManagerAgent () {
    require(isAssetManagerAgent(msg.sender), 'unauthorized - must be asset mgr agent');
    _;
  }

  modifier assertIsClientManager () {
    require(isClientManager(msg.sender), 'unauthorized - must be client mgr');
    _;
  }

  modifier assertIsClientManagerAgent () {
    require(isClientManagerAgent(msg.sender), 'unauthorized - must be client mgr agent');
    _;
  }

  function getAssetManagerRole () view public returns (bytes32) {
    return dataBytes32["roleAssetManager"];
  }

  function getClientManagerRole () view public returns (bytes32) {
    return dataBytes32["roleClientManager"];
  }

  function isAssetManager(address _addr) view public returns (bool) {
    return acl().hasRole(dataString["aclContext"], _addr, dataBytes32["roleAssetManager"]);
  }

  function isAssetManagerAgent(address _addr) view public returns (bool) {
    bytes32[] memory r = new bytes32[](2);
    r[0] = dataBytes32["roleAssettManagerAgent"];
    r[1] = dataBytes32["roleAssetManager"];
    return acl().hasAnyRole(dataString["aclContext"], _addr, r);
  }

  function isClientManager(address _addr) view public returns (bool) {
    return acl().hasRole(dataString["aclContext"], _addr, dataBytes32["roleClientManager"]);
  }

  function isClientManagerAgent(address _addr) view public returns (bool) {
    bytes32[] memory r = new bytes32[](2);
    r[0] = dataBytes32["roleClientManagerAgent"];
    r[1] = dataBytes32["roleClientManager"];
    return acl().hasAnyRole(dataString["aclContext"], _addr, r);
  }

  function acl () view internal returns (IACL) {
    return IACL(dataAddress["acl"]);
  }
}

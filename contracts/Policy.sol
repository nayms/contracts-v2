pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/Proxy.sol";

contract Policy is AccessControl, Proxy {
  constructor (
    address _acl,
    string memory _aclContext,
    address _policyImpl,
    string memory _name
  ) AccessControl(_acl, _aclContext) Proxy(_policyImpl) public {
    dataString["name"] = _name;
  }

  function upgrade (address _implementation, bytes memory _assetMgrSig, bytes memory _clientMgrSig) public assertIsAdmin {
    address assetMgr = getUpgradeSigner(_implementation, _assetMgrSig);
    address clientMgr = getUpgradeSigner(_implementation, _clientMgrSig);

    require(hasRole(assetMgr, ROLE_ASSET_MANAGER), 'must be signed by asset manager');
    require(hasRole(clientMgr, ROLE_CLIENT_MANAGER), 'must be signed by client manager');

    setImplementation(_implementation);
  }
}

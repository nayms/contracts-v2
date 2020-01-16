pragma solidity >=0.5.8;

import "./base/Controller.sol";
import "./base/Proxy.sol";

contract Policy is Controller, Proxy {
  constructor (
    address _acl,
    address _settings,
    string memory _entityContext,
    address _policyImpl,
    string memory _name
  ) Controller(_acl, _settings) Proxy(_policyImpl) public {
    dataString["entityContext"] = _entityContext;
    dataString["name"] = _name;
  }

  function upgrade (address _implementation, bytes memory _assetMgrSig, bytes memory _clientMgrSig) public assertIsAdmin {
    address assetMgr = getUpgradeSigner(_implementation, _assetMgrSig);
    address clientMgr = getUpgradeSigner(_implementation, _clientMgrSig);

    require(hasRole(assetMgr, ROLE_ASSET_MANAGER), 'must be approved by asset manager');
    require(hasRole(clientMgr, ROLE_CLIENT_MANAGER), 'must be approved by client manager');

    setImplementation(_implementation);
  }
}

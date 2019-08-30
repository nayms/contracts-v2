pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/Proxy.sol";

contract FUC is AccessControl, Proxy {
  constructor (
    address _acl,
    string memory _aclContext,
    address _fucImpl,
    string memory _name
  ) AccessControl(_acl, _aclContext) Proxy(_fucImpl) public {
    dataString["name"] = _name;
  }

  function upgrade (address _implementation, bytes memory _assetMgrSig, bytes memory _clientMgrSig) assertIsAdmin public {
    address assetMgr = getUpgradeSigner(_implementation, _assetMgrSig);
    address clientMgr = getUpgradeSigner(_implementation, _clientMgrSig);

    require(isAssetManager(assetMgr), 'must be approved by asset mgr');
    require(isClientManager(clientMgr), 'must be approved by client mgr');

    setImplementation(_implementation);
  }
}

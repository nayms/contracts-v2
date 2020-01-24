pragma solidity >=0.5.8;

import "./base/Controller.sol";
import "./base/Proxy.sol";

contract Policy is Controller, Proxy {
  constructor (
    address _acl,
    address _settings,
    string memory _entityContext,
    address _policyImpl,
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds
  ) Controller(_acl, _settings) Proxy(_policyImpl) public {
    dataString["entityContext"] = _entityContext;
    dataUint256["initiationDate"] = _initiationDate;
    dataUint256["startDate"] = _startDate;
    dataUint256["maturationDate"] = _maturationDate;
    dataUint256["premiumIntervalSeconds"] = _premiumIntervalSeconds;
    dataAddress["unit"] = _unit;
  }

  function upgrade (address _implementation, bytes memory _assetMgrSig, bytes memory _clientMgrSig) public assertIsAdmin {
    address assetMgr = getUpgradeSigner(_implementation, _assetMgrSig);
    address clientMgr = getUpgradeSigner(_implementation, _clientMgrSig);

    require(hasRole(assetMgr, ROLE_ASSET_MANAGER), 'must be approved by asset manager');
    require(hasRole(clientMgr, ROLE_CLIENT_MANAGER), 'must be approved by client manager');

    setImplementation(_implementation);
  }
}

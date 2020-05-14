pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/Proxy.sol";

contract Policy is Controller, Proxy {
  constructor (
    address _acl,
    address _settings,
    address _creatorEntity,
    address _policyImpl,
    address _policyOwner,
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256 _brokerCommissionBP,
    uint256 _assetManagerCommissionBP,
    uint256 _naymsCommissionBP
  ) Controller(_acl, _settings) Proxy(_policyImpl) public {
    // set policy owner
    acl().assignRole(aclContext(), _policyOwner, ROLE_POLICY_OWNER);
    // set properties
    dataAddress["creatorEntity"] = _creatorEntity;
    dataUint256["initiationDate"] = _initiationDate;
    dataUint256["startDate"] = _startDate;
    dataUint256["maturationDate"] = _maturationDate;
    dataAddress["unit"] = _unit;
    dataUint256["premiumIntervalSeconds"] = _premiumIntervalSeconds;
    dataUint256["brokerCommissionBP"] = _brokerCommissionBP;
    dataUint256["assetManagerCommissionBP"] = _assetManagerCommissionBP;
    dataUint256["naymsCommissionBP"] = _naymsCommissionBP;
  }

  function upgrade (address _implementation, bytes memory _assetMgrSig, bytes memory _clientMgrSig) public assertIsAdmin {
    address assetMgr = getUpgradeSigner(_implementation, _assetMgrSig);
    address clientMgr = getUpgradeSigner(_implementation, _clientMgrSig);

    require(inRoleGroup(assetMgr, ROLEGROUP_ASSET_MANAGERS), 'must be approved by asset manager');
    require(inRoleGroup(clientMgr, ROLEGROUP_CLIENT_MANAGERS), 'must be approved by client manager');

    setImplementation(_implementation);
  }
}

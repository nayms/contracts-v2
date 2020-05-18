pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";

contract Policy is Controller, DiamondProxy {
  constructor (
    address _acl,
    address _settings,
    address _creatorEntity,
    address _policyOwner,
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256 _brokerCommissionBP,
    uint256 _assetManagerCommissionBP,
    uint256 _naymsCommissionBP
  ) Controller(_acl, _settings) DiamondProxy() public {
    // set implementations
    _registerFacets(settings().getRootAddresses(SETTING_POLICY_IMPL));
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

  function upgrade (address[] memory _facets) public assertIsAdmin {
    _registerFacets(_facets);
  }
}

pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";
import "./base/IPolicy.sol";

contract Policy is Controller, DiamondProxy {
  constructor (
    address _acl,
    address _settings,
    address _creatorEntity,
    address _policyOwner,
    uint256[] memory _dates,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256[] memory _commmissionsBP
  ) Controller(_acl, _settings) DiamondProxy() public {
    // set implementations
    _registerFacets(settings().getRootAddresses(SETTING_POLICY_IMPL));
    // set policy owner
    acl().assignRole(aclContext(), _policyOwner, ROLE_POLICY_OWNER);
    // set properties
    dataAddress["creatorEntity"] = _creatorEntity;
    dataUint256["initiationDate"] = _dates[0];
    dataUint256["startDate"] = _dates[1];
    dataUint256["maturationDate"] = _dates[2];
    dataAddress["unit"] = _unit;
    dataUint256["premiumIntervalSeconds"] = _premiumIntervalSeconds;
    dataUint256["brokerCommissionBP"] = _commmissionsBP[0];
    dataUint256["assetManagerCommissionBP"] = _commmissionsBP[1];
    dataUint256["naymsCommissionBP"] = _commmissionsBP[2];
    // initialize
    IPolicy(address(this)).initialize();
  }
}

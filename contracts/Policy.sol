pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";

contract Policy is Controller, DiamondProxy {
  constructor (
    address _settings,
    address[] memory _stakeholders,
    uint256[] memory _dates,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256[] memory _commmissionsBP
  ) Controller(_settings) DiamondProxy() public {
    // set implementations
    _registerFacets(settings().getRootAddresses(SETTING_POLICY_IMPL));
    // set properties
    dataAddress["creatorEntity"] = _stakeholders[0];
    dataUint256["initiationDate"] = _dates[0];
    dataUint256["startDate"] = _dates[1];
    dataUint256["maturationDate"] = _dates[2];
    dataAddress["unit"] = _unit;
    dataUint256["premiumIntervalSeconds"] = _premiumIntervalSeconds;
    dataUint256["brokerCommissionBP"] = _commmissionsBP[0];
    dataUint256["capitalProviderCommissionBP"] = _commmissionsBP[1];
    dataUint256["naymsCommissionBP"] = _commmissionsBP[2];
    // set roles
    acl().assignRole(aclContext(), _stakeholders[1], ROLE_POLICY_OWNER);
    acl().assignRole(aclContext(), _stakeholders[2], ROLE_CAPITAL_PROVIDER);
    acl().assignRole(aclContext(), _stakeholders[3], ROLE_INSURED_PARTY);
    acl().assignRole(aclContext(), _stakeholders[4], ROLE_BROKER);
  }
}

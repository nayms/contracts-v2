pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";
import ".//PolicyFacetBase.sol";

contract Policy is Controller, DiamondProxy, PolicyFacetBase {
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
    dataAddress["treasury"] = _stakeholders[0];
    dataUint256["initiationDate"] = _dates[0];
    dataUint256["startDate"] = _dates[1];
    dataUint256["maturationDate"] = _dates[2];
    dataAddress["unit"] = _unit;
    dataUint256["premiumIntervalSeconds"] = _premiumIntervalSeconds;
    dataUint256["brokerCommissionBP"] = _commmissionsBP[0];
    dataUint256["claimsAdminCommissionBP"] = _commmissionsBP[1];
    dataUint256["naymsCommissionBP"] = _commmissionsBP[2];
    // set roles
    acl().assignRole(aclContext(), _stakeholders[1], ROLE_POLICY_OWNER);
    acl().assignRole(aclContext(), _stakeholders[3], ROLE_PENDING_INSURED_PARTY);
    acl().assignRole(aclContext(), _stakeholders[5], ROLE_PENDING_CLAIMS_ADMIN);
    // created by underwriter rep?
    if (_isRepOfEntity(_stakeholders[1], _stakeholders[2])) {
      acl().assignRole(aclContext(), _stakeholders[2], ROLE_UNDERWRITER);
      dataBool["underwriterApproved"] = true;
      acl().assignRole(aclContext(), _stakeholders[4], ROLE_PENDING_BROKER);
    } 
    // created by broker rep?
    else if (_isRepOfEntity(_stakeholders[1], _stakeholders[4])) {
      acl().assignRole(aclContext(), _stakeholders[4], ROLE_BROKER);
      dataBool["brokerApproved"] = true;
      acl().assignRole(aclContext(), _stakeholders[2], ROLE_PENDING_UNDERWRITER);
    } 
    else {
      revert("must be broker or underwriter");
    }
  }
}

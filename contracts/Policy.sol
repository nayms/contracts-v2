// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/Proxy.sol";
import "./PolicyFacetBase.sol";

contract Policy is Controller, Proxy, PolicyFacetBase {
  constructor (
    address _settings,
    address _caller,
    uint256 _type,
    uint256[] memory _dates,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256[] memory _commmissionsBP,
    address[] memory _stakeholders
  ) Controller(_settings) Proxy() public
  {
    _setDelegateAddress(settings().getRootAddress(SETTING_POLICY_DELEGATE));
    _setPolicyState(POLICY_STATE_CREATED);

    // set properties
    dataAddress["creator"] = msg.sender;
    dataAddress["treasury"] = _stakeholders[0];
    dataUint256["initiationDate"] = _dates[0];
    dataUint256["startDate"] = _dates[1];
    dataUint256["maturationDate"] = _dates[2];
    dataAddress["unit"] = _unit;
    dataUint256["type"] = _type;
    dataUint256["premiumIntervalSeconds"] = _premiumIntervalSeconds;
    dataUint256["brokerCommissionBP"] = _commmissionsBP[0];
    dataUint256["claimsAdminCommissionBP"] = _commmissionsBP[1];
    dataUint256["naymsCommissionBP"] = _commmissionsBP[2];
    dataUint256["underwriterCommissionBP"] = _commmissionsBP[3];

    // set roles, _stakeholders[0] is the treasury
    acl().assignRole(aclContext(), _caller, ROLE_POLICY_OWNER);
    acl().assignRole(aclContext(), _stakeholders[3], ROLE_PENDING_CLAIMS_ADMIN);
    acl().assignRole(aclContext(), _stakeholders[4], ROLE_PENDING_INSURED_PARTY);

    // created by underwriter rep?
    if (_isRepOfEntity(_caller, _stakeholders[2])) {
      acl().assignRole(aclContext(), _stakeholders[2], ROLE_UNDERWRITER);
      dataBool["underwriterApproved"] = true;
      acl().assignRole(aclContext(), _stakeholders[1], ROLE_PENDING_BROKER);
    } 
    // created by broker rep?
    else if (_isRepOfEntity(_caller, _stakeholders[1])) {
      acl().assignRole(aclContext(), _stakeholders[1], ROLE_BROKER);
      dataBool["brokerApproved"] = true;
      acl().assignRole(aclContext(), _stakeholders[2], ROLE_PENDING_UNDERWRITER);
    } 
    else {
      revert("must be broker or underwriter");
    }
  }
}

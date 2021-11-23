// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/Proxy.sol";
import "./base/Child.sol";
import "./PolicyFacetBase.sol";

contract Policy is Controller, Proxy, PolicyFacetBase, Child {
  constructor (
    bytes32 _id,
    address _settings,
    address _caller,
    uint256[] memory _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP,
    address[] memory _unitAndTreasuryAndStakeholders
  ) Controller(_settings) Proxy() public
  {
    _setParent(msg.sender);
    _setDelegateAddress(settings().getRootAddress(SETTING_POLICY_DELEGATE));
    _setPolicyState(POLICY_STATE_CREATED);

    // set properties
    dataBytes32["id"] = _id;
    dataUint256["type"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[0];
    dataUint256["premiumIntervalSeconds"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[1];
    dataUint256["initiationDate"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[2];
    dataUint256["startDate"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[3];
    dataUint256["maturationDate"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[4];
    dataUint256["brokerCommissionBP"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[5];
    dataUint256["underwriterCommissionBP"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[6];
    dataUint256["claimsAdminCommissionBP"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[7];
    dataUint256["naymsCommissionBP"] = _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP[8];
    dataAddress["unit"] = _unitAndTreasuryAndStakeholders[0];
    dataAddress["treasury"] = _unitAndTreasuryAndStakeholders[1];

    // set basic roles
    acl().assignRole(aclContext(), _caller, ROLE_POLICY_OWNER);
    acl().assignRole(aclContext(), _unitAndTreasuryAndStakeholders[2], ROLE_PENDING_BROKER);
    acl().assignRole(aclContext(), _unitAndTreasuryAndStakeholders[3], ROLE_PENDING_UNDERWRITER);
    acl().assignRole(aclContext(), _unitAndTreasuryAndStakeholders[4], ROLE_PENDING_CLAIMS_ADMIN);
    acl().assignRole(aclContext(), _unitAndTreasuryAndStakeholders[5], ROLE_PENDING_INSURED_PARTY);

    // created by underwriter rep?
    if (_isRepOfEntity(_caller, _unitAndTreasuryAndStakeholders[3])) {
      acl().assignRole(aclContext(), _unitAndTreasuryAndStakeholders[3], ROLE_UNDERWRITER);
      dataBool["underwriterApproved"] = true;
    } 
    // created by broker rep?
    else if (_isRepOfEntity(_caller, _unitAndTreasuryAndStakeholders[2])) {
      acl().assignRole(aclContext(), _unitAndTreasuryAndStakeholders[2], ROLE_BROKER);
      dataBool["brokerApproved"] = true;
    } 
    else {
      revert("must be broker or underwriter");
    }
  }
}

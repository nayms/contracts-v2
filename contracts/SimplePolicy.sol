// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/Proxy.sol";
import "./base/ISimplePolicy.sol";
import "./base/ISimplePolicyStates.sol";

contract SimplePolicy is Controller, Proxy, ISimplePolicy, ISimplePolicyStates {
  
  /**
   * @dev SimplePolicy constructor.
   * 
   * `_stakeholders` and '_approvalSignatures'
   *    * Index 0: Broker entity address.
   *    * Index 1: Underwriter entity address.
   *    * Index 2: Claims admin entity address.
   *    * Index 3: Insured party entity address.
   */
  constructor (
    bytes32 _id,
    uint256 _number,
    address _settings,
    address _caller,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _limit,
    address[] memory _stakeholders,
    bytes[] memory _approvalSignatures
  ) Controller(_settings) Proxy() public
  { 
    require(_limit > 0, 'limit not > 0');

    dataBytes32["id"] = _id;
    dataUint256["number"] = _number;
    dataUint256["startDate"] = _startDate;
    dataUint256["maturationDate"] = _maturationDate;
    dataAddress["unit"] = _unit;
    dataUint256["limit"] = _limit;
    dataUint256["state"] = POLICY_STATE_CREATED;
    
    // set roles
    acl().assignRole(aclContext(), _caller, ROLE_POLICY_OWNER);
    acl().assignRole(aclContext(), _stakeholders[2], ROLE_BROKER);
    acl().assignRole(aclContext(), _stakeholders[3], ROLE_UNDERWRITER);
    acl().assignRole(aclContext(), _stakeholders[4], ROLE_CLAIMS_ADMIN);
    acl().assignRole(aclContext(), _stakeholders[5], ROLE_INSURED_PARTY);

    // created by underwriter rep?
    if (acl().hasRoleInGroup(aclContext(), _stakeholders[1], ROLEGROUP_ENTITY_REPS)) {
      acl().assignRole(aclContext(), _stakeholders[1], ROLE_UNDERWRITER);
      dataBool["underwriterApproved"] = true;
    } 
    // created by broker rep?
    else if (acl().hasRoleInGroup(aclContext(), _stakeholders[0], ROLEGROUP_ENTITY_REPS)) {
      acl().assignRole(aclContext(), _stakeholders[0], ROLE_BROKER);
      dataBool["brokerApproved"] = true;
    } 
    else {
      revert("must be broker or underwriter");
    }

    // TODO: Only bulk approve
    // if (_approvalSignatures.length = 4) {
    //   pol.bulkApprove(_approvalSignatures);
    // }

    emit NewSimplePolicy(_id, address(this));
  }

  function getSimplePolicyInfo() external override view returns (
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 limit_,
    uint256 state_
  )
  {
    startDate_ = dataUint256["startDate"];
    maturationDate_ = dataUint256["maturationDate"];
    unit_ = dataAddress["unit"];
    limit_ = dataUint256["limit"];
    state_ = dataUint256["state"];
  }

  function getUnit() external virtual override view returns (address unit_) {
    unit_ = dataAddress["unit"];
  }

  function getUnitAndLimit() external virtual override view returns (address unit_, uint256 limit_) {
    unit_ = dataAddress["unit"];
    limit_ = dataUint256["limit"];
  }

  function checkAndUpdateState() external virtual override returns (bool reduceTotalLimit_) {

    bytes32 id = dataBytes32["id"];
    uint256 state = dataUint256["state"];
    reduceTotalLimit_ = false;

    if (block.timestamp >= dataUint256["maturationDate"] && state < POLICY_STATE_MATURED) {
      // move state to matured
      dataUint256["state"] = POLICY_STATE_MATURED;

      reduceTotalLimit_ = true;

      // emit event
      emit SimplePolicyStateUpdated(id, POLICY_STATE_MATURED, msg.sender);
    } else if (block.timestamp >= dataUint256["startDate"] && state < POLICY_STATE_ACTIVE) {
      // move state to active
      dataUint256["state"] = POLICY_STATE_ACTIVE;

      // emit event
      emit SimplePolicyStateUpdated(id, POLICY_STATE_ACTIVE, msg.sender);
    }
  }
}

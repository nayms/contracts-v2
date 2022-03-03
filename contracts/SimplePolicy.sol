// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/AccessControl.sol";
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
   *    * Index 4: Treasury address.
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
    dataAddress["treasury"] = _stakeholders[4];
    
    // set roles
    acl().assignRole(aclContext(), _caller, ROLE_POLICY_OWNER);
    acl().assignRole(aclContext(), _stakeholders[0], ROLE_BROKER);
    acl().assignRole(aclContext(), _stakeholders[1], ROLE_UNDERWRITER);
    acl().assignRole(aclContext(), _stakeholders[2], ROLE_CLAIMS_ADMIN);
    acl().assignRole(aclContext(), _stakeholders[3], ROLE_INSURED_PARTY);

    bool underwriterRep_;
    bool brokerRep_;
    (underwriterRep_, brokerRep_) = _isBrokerOrUnderwriterRep(_caller, _stakeholders[0], _stakeholders[1]);
    
    require(underwriterRep_ || brokerRep_, "must be broker or underwriter");

    dataBool["underwriterApproved"] = underwriterRep_;
    dataBool["brokerApproved"] = brokerRep_;
    
    // TODO: Only bulk approve
    // if (_approvalSignatures.length = 4) {
    //   pol.bulkApprove(_approvalSignatures);
    // }

    emit NewSimplePolicy(_id, address(this));
  }

  function _isBrokerOrUnderwriterRep(
    address _caller, 
    address _broker, 
    address _underwriter
  ) 
  internal 
  view
  returns (bool underwriterRep_, bool brokerRep_) 
  {
    bytes32 ctxSystem = acl().getContextAtIndex(0);
    bytes32 ctxBroker = AccessControl(_broker).aclContext();
    bytes32 ctxUnderwriter = AccessControl(_underwriter).aclContext();

    // entity has underwriter role in system context?
    bool isUnderwriter = acl().hasRoleInGroup(ctxSystem, _underwriter, ROLEGROUP_UNDERWRITERS);

    // caller is underwriter entity rep?
    underwriterRep_ = isUnderwriter && acl().hasRoleInGroup(ctxUnderwriter, _caller, ROLEGROUP_ENTITY_REPS);

    // entity has broker role in system context?
    bool isBroker = acl().hasRoleInGroup(ctxSystem, _broker, ROLE_BROKER);

    // caller is broker entity rep?
    brokerRep_ = isBroker && acl().hasRoleInGroup(ctxBroker, _caller, ROLEGROUP_ENTITY_REPS);

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

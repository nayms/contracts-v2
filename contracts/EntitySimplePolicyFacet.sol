// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./EntityFacetBase.sol";
import "./base/IEntitySimplePolicyFacet.sol";
import "./base/ISimplePolicyStates.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";
import "./base/ReentrancyGuard.sol";

contract EntitySimplePolicyFacet is EntityFacetBase, IEntitySimplePolicyFacet, IDiamondFacet, ISimplePolicyStates, ReentrancyGuard {
  using SafeMath for uint256;
  
  modifier assertSimplePolicyCreationEnabled () {
    require(this.allowSimplePolicy(), 'simple policy creation disabled');
    _;
  }

  modifier assertCurrencyEnabled(address _unit) {
   uint256 _collateralRatio;
   uint256 _maxCapital;
   (_collateralRatio, _maxCapital) = this.getEnabledCurrency(_unit);
    require((_collateralRatio > 0) && (_maxCapital > 0), 'currency disabled');
    _;
  }

  modifier assertEnoughBalance(address _unit, uint256 _limit) {
    require(_limit > 0, 'limit not > 0');
    uint256 collateralRatio;
    uint256 maxCapital;
    (collateralRatio, maxCapital) = this.getEnabledCurrency(_unit);
    uint256 balance = dataUint256[__a(_unit, "balance")];
    require(maxCapital >= balance.add(_limit).mul(collateralRatio).div(1000), 'balance below colallateral ratio');
    _;
  }

  constructor (address _settings) Controller(_settings) public {
  }

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntitySimplePolicyFacet.createSimplePolicy.selector,
      IEntitySimplePolicyFacet.paySimplePremium.selector,
      IEntitySimplePolicyFacet.paySimpleClaim.selector,
      IEntitySimplePolicyFacet.updateAllowSimplePolicy.selector,
      IEntitySimplePolicyFacet.allowSimplePolicy.selector,
      IEntitySimplePolicyFacet.getNumSimplePolicies.selector,
      IEntitySimplePolicyFacet.getSimplePolicyInfo.selector,
      IEntitySimplePolicyFacet.checkAndUpdateState.selector,
      IEntitySimplePolicyFacet.verifySimplePolicy.selector
    );
  }

  // IEntitySimplePolicyFacet

  function createSimplePolicy(
    bytes32 _id,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _limit,
    address[] calldata _stakeholders,
    bytes[] calldata _approvalSignatures
  ) 
  external 
  override 
  assertSimplePolicyCreationEnabled
  assertCurrencyEnabled(_unit)
  assertEnoughBalance(_unit, _limit)
  {

    dataUint256[__a(_unit, "premiumsPaid")] += _limit;
    dataUint256[__a(_unit, "claimsPaid")] = 0;

    dataUint256[__b(_id, "startDate")] = _startDate;
    dataUint256[__b(_id, "maturationDate")] = _maturationDate;
    dataAddress[__b(_id, "unit")] = _unit;
    dataUint256[__b(_id, "limit")] = _limit;

    dataUint256[__b(_id, "state")] = POLICY_STATE_CREATED;

    bytes32 aclContext = keccak256(__ab(address(this), _id));
    dataBytes32[__b(_id, "policyAclContext")] = aclContext;

    // set basic roles
    acl().assignRole(aclContext, address(this), ROLE_POLICY_OWNER);
    acl().assignRole(aclContext, _stakeholders[2], ROLE_BROKER);
    acl().assignRole(aclContext, _stakeholders[3], ROLE_UNDERWRITER);
    acl().assignRole(aclContext, _stakeholders[4], ROLE_CLAIMS_ADMIN);
    acl().assignRole(aclContext, _stakeholders[5], ROLE_INSURED_PARTY);

    // created by underwriter rep?
    if (inRoleGroupWithContext(msg.sender, _stakeholders[3], ROLEGROUP_ENTITY_REPS)) {
      acl().assignRole(aclContext, _stakeholders[3], ROLE_UNDERWRITER);
      dataBool["underwriterApproved"] = true;
    } 
    // created by broker rep?
    else if (inRoleGroupWithContext(msg.sender, _stakeholders[2], ROLEGROUP_ENTITY_REPS)) {
      acl().assignRole(aclContext, _stakeholders[2], ROLE_BROKER);
      dataBool["brokerApproved"] = true;
    } 
    else {
      revert("must be broker or underwriter");
    }

    uint256 policyNumber = dataUint256["numSimplePolicies"];

    //forward and reverse lookups
    dataUint256[__b (_id, "simplePolicyNumber")] = policyNumber;
    dataBytes32[__i (policyNumber, "simplePolicyNumber")] = _id;

    dataUint256["numSimplePolicies"] += 1;

    // ToDo
    // //Only bulk approve
    // if (_approvalSignatures.length = 4) {
    //   pol.bulkApprove(_approvalSignatures);
    // }

    emit NewPolicy(_id, address(this), msg.sender);
  }
    
  function _policyAclContext(bytes32 _id) private pure returns (bytes32) {
    return dataBytes32[__b(_id, "policyAclContext")];
  }

  // This is called on the entitywhere a policy is created.
  // It transfers the amount from your entity (specified by entityAddress) to the the entity where the policy is created 
  // entityAddress should be specified because it is possible for msg.sender to belong to multiple entities.
  function paySimplePremium(bytes32 _id, address _entityAddress, uint256 _amount)
    external
    override
    nonReentrant
  {
    // assert msg.sender has the role entity representative on _entityAddress
    // add _amount to premiumsPaid_ 
    // then move money from _entityAddress to this entity

    address policyUnitAddress;
 

  }

  function updateAllowSimplePolicy(bool _allow) external override assertIsSystemManager(msg.sender)
  {
      dataBool["allowSimplePolicy"] = _allow;
  }

  function allowSimplePolicy() external override view returns (bool _allow)
  {
    return dataBool["allowSimplePolicy"];
  }

  function getNumSimplePolicies() external override view returns (uint256 _numPolicies)
  {
    return dataUint256["numSimplePolicies"];
  }

  function getSimplePolicyId (uint256 _simplePolicyNumber) public view override returns (bytes32 _id)
  {
    return dataBytes32[__i(_simplePolicyNumber, "simplePolicyNumber")];
  }

  function getSimplePolicyInfo (bytes32 _id) public view override returns (
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 limit_,
    uint256 state_,
    uint256 premiumsPaid_,
    uint256 claimsPaid_
  )
  {
    startDate_ = dataUint256[__b(_id, "startDate")];
    maturationDate_ = dataUint256[__b(_id, "maturationDate")];
    unit_ = dataAddress[__b(_id, "unit")];
    limit_ = dataUint256[__b(_id, "limit")];
    state_ = dataUint256[__b(_id, "state")];
    premiumsPaid_ = dataUint256[__a(unit_, "premiumsPaid")];
    claimsPaid_ = dataUint256[__a(unit_, "claimsPaid")];
  }

  // This is performed by a nayms system manager and pays the insured party in the event of a claim. 
  function paySimpleClaim (bytes32 _id, uint256 _amount) 
    external 
    override 
    view 
    nonReentrant 
    assertIsSystemManager(msg.sender)
  {
    require(_amount > 0, 'invalid claim amount');
    require(dataUint256[__b(_id, "limit")] >= _amount.add(dataUint256[__a(unit_, "claimsPaid")]), 'exceeds policy limit');

    address unit_ = dataAddress[__b(_id, "unit")];

    dataUint256[__a(unit_, "claimsPaid")] += _amount;

    // payout the insured party!
    IERC20(unit_).transfer(_stakeholders[5], _amount);
    
  }

  function checkAndUpdateState(bytes32 _id) external override 
  {
    uint256 state = dataUint256[__b(_id, "state")];

    if (block.timestamp >= dataUint256[__b(_id, "maturationDate")] && state < POLICY_STATE_MATURED) {
      // move state to matured
      dataUint256[__b(_id, "state")] = POLICY_STATE_MATURED;

      // remove from balance
      address unit = dataAddress[__b(_id, "unit")];
      dataUint256[__a(unit, "premiumsPaid")] -= dataUint256[__b(_id, "limit")];
      
      // emit event
      emit SimplePolicyStateUpdated(_id, POLICY_STATE_MATURED, msg.sender);

    } else if (block.timestamp >= dataUint256[__b(_id, "startDate")] && state < POLICY_STATE_ACTIVE) {
      // move state to active
      dataUint256[__b(_id, "state")] = POLICY_STATE_ACTIVE;

      // emit event
      emit SimplePolicyStateUpdated(_id, POLICY_STATE_ACTIVE, msg.sender);
    }
  }

  //to be determined
  function verifySimplePolicy (bytes32 _id) external override 
  {

  }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./EntityFacetBase.sol";
import "./base/IEntitySimplePolicyFacet.sol";
import "./base/ISimplePolicyStates.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";
import "./base/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract EntitySimplePolicyFacet is EntityFacetBase, IEntitySimplePolicyFacet, IDiamondFacet, ISimplePolicyStates, ReentrancyGuard {
  using SafeMath for uint256;

  constructor (address _settings) public Controller(_settings) {
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
      IEntitySimplePolicyFacet.verifySimplePolicy.selector,
      IEntitySimplePolicyFacet.getEnabledCurrency.selector,
      IEntitySimplePolicyFacet.updateEnabledCurrency.selector
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
  {

    //balance is how much money is deposited into the entity. This is only updated if you deposit or withdraw


    require(this.allowSimplePolicy(), 'creation disabled');
    require(_limit > 0, 'limit not > 0');

    uint256 collateralRatio = dataUint256[__a(_unit, "collateralRatio")];
    uint256 maxCapital = dataUint256[__a(_unit, "maxCapital")];
    uint256 balance = dataUint256[__a(_unit, "balance")];
    uint256 newTotalLimit = dataUint256[__b(_unit, "totalLimit")] + _limit;

    require((collateralRatio > 0) && (maxCapital > 0), 'currency disabled');
    require(balance >= newTotalLimit.mul(collateralRatio).div(1000), 'collateral ratio not met');
    require(maxCapital >= newTotalLimit, 'total limit above max capital');

    dataUint256[__b(_unit, "totalLimit")] = newTotalLimit;



    // require(maxCapital >= balance.add(_limit).mul(collateralRatio).div(1000), 'balance above max capital collateral ratio');
   
    { // stack too deep :'(
      dataUint256[__b(_id, "startDate")] = _startDate;
      dataUint256[__b(_id, "maturationDate")] = _maturationDate;
      dataAddress[__b(_id, "unit")] = _unit;
      dataUint256[__b(_id, "limit")] = _limit;
      dataUint256[__b(_id, "state")] = POLICY_STATE_CREATED;
      dataUint256[__a(_unit, "claimsPaid")] = 0;
      dataUint256[__a(_unit, "premiumsPaid")] = 0;

      bytes32 aclContext = keccak256(abi.encodePacked(address(this), _id));
      dataBytes32[__b(_id, "policyAclContext")] = aclContext;

      // set basic roles
      // acl().assignRole(aclContext, msg.sender, ROLE_POLICY_OWNER);
      console.log("assigning basic roles");
      acl().assignRole(aclContext, _stakeholders[2], ROLE_BROKER);
      acl().assignRole(aclContext, _stakeholders[3], ROLE_UNDERWRITER);
      acl().assignRole(aclContext, _stakeholders[4], ROLE_CLAIMS_ADMIN);
      acl().assignRole(aclContext, _stakeholders[5], ROLE_INSURED_PARTY);

      console.log("basic roles assigned");
      // created by underwriter rep?
      console.log("checking underwriter or broker");
      if (acl().hasRoleInGroup(AccessControl(msg.sender).aclContext(), _stakeholders[1], ROLEGROUP_ENTITY_REPS)) {
        console.log("he is an underwriter");
        acl().assignRole(aclContext, _stakeholders[1], ROLE_UNDERWRITER);
        dataBool[__b(_id, "underwriterApproved")] = true;
      } 
      // created by broker rep?
      else if (acl().hasRoleInGroup(AccessControl(msg.sender).aclContext(), _stakeholders[0], ROLEGROUP_ENTITY_REPS)) {
        console.log("he is a broker");
        acl().assignRole(aclContext, _stakeholders[0], ROLE_BROKER);
        dataBool[__b(_id, "brokerApproved")] = true;
      } 
      else {
        console.log("reverting");
        revert("must be broker or underwriter");
      }
    }

    console.log("update number");
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

    console.log("done");
    emit NewSimplePolicy(_id, address(this));
  }
    
  function _policyAclContext(bytes32 _id) private view returns (bytes32) {
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
    require(_amount > 0, 'invalid premium amount');

    // assert msg.sender has the role entity representative on _entityAddress
    bytes32 entityCtx = AccessControl(_entityAddress).aclContext();
    require(acl().hasRoleInGroup(entityCtx, msg.sender, ROLEGROUP_ENTITY_REPS), 'not an entity rep');

    // add _amount to premiumsPaid
    address unit = dataAddress[__b(_id, "unit")];
    dataUint256[__a(unit, "premiumsPaid")] += _amount;

    // then move money from _entityAddress to this entity
    IERC20(unit).transferFrom(_entityAddress, address(this), _amount);

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
    payable
    nonReentrant 
    assertIsSystemManager(msg.sender)
  {
    require(_amount > 0, 'invalid claim amount');
    
    address unit_ = dataAddress[__b(_id, "unit")];
    require(dataUint256[__b(_id, "limit")] >= _amount.add(dataUint256[__a(unit_, "claimsPaid")]), 'exceeds policy limit');

    dataUint256[__a(unit_, "claimsPaid")] += _amount;

    // payout the insured party!    
    bytes32 aclContext = _policyAclContext(_id);
    address insured = acl().getUsersForRole(aclContext, ROLE_INSURED_PARTY)[0];
    IERC20(unit_).transfer(insured, _amount);
    
  }

  function checkAndUpdateState(bytes32 _id) external override 
  {
    uint256 state = dataUint256[__b(_id, "state")];

    if (block.timestamp >= dataUint256[__b(_id, "maturationDate")] && state < POLICY_STATE_MATURED) {
      // move state to matured
      dataUint256[__b(_id, "state")] = POLICY_STATE_MATURED;

      // remove from balance
      address unit = dataAddress[__b(_id, "unit")];

      //Todo: remove policy _limit from totalLimit
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

  function updateEnabledCurrency(
    address _unit,
    uint256 _collateralRatio,
    uint256 _maxCapital
  )
  external
  override
  assertIsSystemManager (msg.sender)
  {
    bool hasUnit = false;
    address[] memory newUnits;
    uint256 unitIndex = 0;

    if(_collateralRatio == 0 && _maxCapital == 0){
      // remove unit
      for (uint256 j = 0; j < dataManyAddresses["enabledUnits"].length; j += 1) {
        if (dataManyAddresses["enabledUnits"][j] != _unit){
          newUnits[unitIndex] = dataManyAddresses["enabledUnits"][j];
          unitIndex ++;
        }
      }
      dataManyAddresses["enabledUnits"] = newUnits;
    }
    else
    // add or update unit 
    {
      if (_collateralRatio > 1000){
        revert("collateral ratio is 0-1000");
      }

      for (uint256 j = 0; j < dataManyAddresses["enabledUnits"].length; j += 1) {
        if (dataManyAddresses["enabledUnits"][j] == _unit){
          hasUnit = true;
          break;
        }
      }
      if (!hasUnit){
        dataManyAddresses["enabledUnits"].push(_unit);
      }
    }

    //Either way, update the values
    dataUint256[__a(_unit, "maxCapital")] = _maxCapital;
    dataUint256[__a(_unit, "collateralRatio")] = _collateralRatio;
  }

  function getEnabledCurrencies() external override view returns (address[] memory)
  {
    return dataManyAddresses["enabledUnits"];
  }

  function getEnabledCurrency(address _unit) external override view returns (uint256 _collateralRatio, uint256 _maxCapital)
  {
    _collateralRatio = dataUint256[__a(_unit, "collateralRatio")];
    _maxCapital = dataUint256[__a(_unit, "maxCapital")];
  }

}

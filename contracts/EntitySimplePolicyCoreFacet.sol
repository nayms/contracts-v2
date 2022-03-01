// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./EntityFacetBase.sol";
import "./base/IEntitySimplePolicyCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";
import "./base/ReentrancyGuard.sol";
import "./SimplePolicy.sol";

contract EntitySimplePolicyCoreFacet is EntityFacetBase, IEntitySimplePolicyCoreFacet, IDiamondFacet, ReentrancyGuard {
  
  using SafeMath for uint256;

  constructor (address _settings) public Controller(_settings) { }

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntitySimplePolicyCoreFacet.createSimplePolicy.selector,
      IEntitySimplePolicyCoreFacet.paySimplePremium.selector,
      IEntitySimplePolicyCoreFacet.paySimpleClaim.selector,
      IEntitySimplePolicyCoreFacet.updateAllowSimplePolicy.selector,
      IEntitySimplePolicyCoreFacet.checkAndUpdateState.selector,
      IEntitySimplePolicyCoreFacet.updateEnabledCurrency.selector
    );
  }

  // IEntitySimplePolicyCoreFacet

  function _validateSimplePolicyCreation(address _unit, uint256 _limit) internal view {
    require(dataBool["allowSimplePolicy"], 'creation disabled');

    uint256 collateralRatio = dataUint256[__a(_unit, "collateralRatio")];
    uint256 maxCapital = dataUint256[__a(_unit, "maxCapital")];
    require((collateralRatio > 0) && (maxCapital > 0), 'currency disabled');

    uint256 newTotalLimit = dataUint256[__a(_unit, "totalLimit")] + _limit;
    require(maxCapital >= newTotalLimit, 'max capital exceeded');

    //balance is how much money is deposited into the entity. This is only updated if you deposit or withdraw
    uint256 balance = dataUint256[__a(_unit, "balance")];
    require(balance >= newTotalLimit.mul(collateralRatio).div(1000), 'collateral ratio not met');
  }

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

    _validateSimplePolicyCreation(_unit, _limit);
    dataUint256[__a(_unit, "totalLimit")] += _limit;

    SimplePolicy simplePolicy = new SimplePolicy(
      _id,
      dataUint256["numSimplePolicies"],
      address(settings()),
      msg.sender,
      _startDate,
      _maturationDate,
      _unit,
      _limit,
      _stakeholders,
      _approvalSignatures
    );

    dataAddress[__i(dataUint256["numSimplePolicies"], "simplePolicyAddress")] = address(simplePolicy);
    dataUint256["numSimplePolicies"]++;
  }

  function _verifyPremiumRep(address _entityAddress) internal view {
    // assert msg.sender has the role entity representative on _entityAddress
    bytes32 entityCtx = AccessControl(_entityAddress).aclContext();
    require(acl().hasRoleInGroup(entityCtx, msg.sender, ROLEGROUP_ENTITY_REPS), 'not an entity rep');
  }

  // This is called on the entitywhere a policy is created.
  // It transfers the amount from your entity (specified by entityAddress) to the the entity where the policy is created 
  // entityAddress should be specified because it is possible for msg.sender to belong to multiple entities.
  function paySimplePremium(bytes32 _id, address _entityAddress, uint256 _amount)
    external
    override
  {
    
    _verifyPremiumRep(_entityAddress);

    ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "simplePolicyAddress")]);

    address unit = policy.getUnit();

    // add _amount to premiumsPaid
    dataUint256[__a(unit, "premiumsPaid")] += _amount;
    dataUint256[__a(unit, "balance")] += _amount;

    // then move money from _entityAddress to this entity
    IERC20(unit).transferFrom(_entityAddress, address(policy), _amount);

  }

  function updateAllowSimplePolicy(bool _allow) external override assertIsSystemManager(msg.sender)
  {
      dataBool["allowSimplePolicy"] = _allow;
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
    
    ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "simplePolicyAddress")]);
    
    address unit;
    uint256 limit;
    (unit, limit) = policy.getUnitAndLimit();

    uint256 claimsPaid = dataUint256[__a(unit, "claimsPaid")];

    require(limit >= _amount.add(claimsPaid), 'exceeds policy limit');

    dataUint256[__a(unit, "claimsPaid")] += _amount;
    dataUint256[__a(unit, "balance")] -= _amount;

    // payout the insured party!    
    address insured = acl().getUsersForRole(policy.aclContext(), ROLE_INSURED_PARTY)[0];
    IERC20(unit).transfer(insured, _amount);
    
  }

  function checkAndUpdateState(bytes32 _id) external override 
  {
    ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "simplePolicyAddress")]);
    
    bool reduceTotalLimit = policy.checkAndUpdateState();
    
    if(reduceTotalLimit) {
      // remove from balance
      address unit;
      uint256 limit;
      (unit, limit) = policy.getUnitAndLimit();

      dataUint256[__a(unit, "totalLimit")] -= limit;
    }
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

}

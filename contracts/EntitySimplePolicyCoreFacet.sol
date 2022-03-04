// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {EntityFacetBase, IERC20} from "./EntityFacetBase.sol";
import "./base/IEntitySimplePolicyCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";
import {SimplePolicy, Controller, AccessControl, ISimplePolicy} from "./SimplePolicy.sol";

contract EntitySimplePolicyCoreFacet is EntityFacetBase, IEntitySimplePolicyCoreFacet, IDiamondFacet {
  
  using SafeMath for uint256;

  constructor (address _settings) public Controller(_settings) { }

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntitySimplePolicyCoreFacet.createSimplePolicy.selector,
      IEntitySimplePolicyCoreFacet.paySimplePremium.selector,
      IEntitySimplePolicyCoreFacet.checkAndUpdateState.selector,
      IEntitySimplePolicyCoreFacet.updateAllowSimplePolicy.selector
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

    dataAddress[__i(dataUint256["numSimplePolicies"], "addressByNumber")] = address(simplePolicy);
    dataAddress[__b(_id, "addressById")] = address(simplePolicy);
    dataUint256["numSimplePolicies"] = dataUint256["numSimplePolicies"].add(1);
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

    require(_amount > 0, 'invalid premium amount');

    ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);

    address unit;
    (, , , , unit, , ) = policy.getSimplePolicyInfo();

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

  function checkAndUpdateState(bytes32 _id) external override 
  {
    ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);
    
    bool reduceTotalLimit = policy.checkAndUpdateState();
    
    if(reduceTotalLimit) {
      // remove from balance
      address unit;
      uint256 limit;
      (, , , , unit, limit, ) = policy.getSimplePolicyInfo();

      dataUint256[__a(unit, "totalLimit")] -= limit;
    }
  }

}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
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

  function _verifyEntityRep(address _entityAddress) internal view {
    bytes32 entityCtx = AccessControl(_entityAddress).aclContext();
    require(acl().hasRoleInGroup(entityCtx, msg.sender, ROLEGROUP_ENTITY_REPS), 'not an entity rep');
  }

  function paySimplePremium(bytes32 _id, address _entityAddress, uint256 _amount)
    external
    override
  {
    
    _verifyEntityRep(_entityAddress);

    require(_amount > 0, 'invalid premium amount');

    ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);

    address unit;
    (, , , , unit, , ) = policy.getSimplePolicyInfo();

    dataUint256[__a(unit, "premiumsPaid")] += _amount;
    dataUint256[__a(unit, "balance")] += _amount;

    IERC20 token = IERC20(unit);
    token.approve(address(this), _amount);
    token.transferFrom(_entityAddress, address(policy), _amount);

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
      address unit;
      uint256 limit;
      (, , , , unit, limit, ) = policy.getSimplePolicyInfo();

      dataUint256[__a(unit, "totalLimit")] -= limit;
    }
  }

}

// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/EternalStorage.sol";
import "./base/IEntitySimplePolicyFacet.sol";
import "./base/ISimplePolicyStates.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";

contract EntitySimplePolicyFacet is EternalStorage, IEntitySimplePolicyFacet, IDiamondFacet, ISimplePolicyStates {
  using SafeMath for uint256;

  modifier assertSimplePolicyCreationEnabled () {
    require(this.allowSimplePolicy(), 'simple policy creation disabled');
    _;
  }

  modifier assertCurrencyIsEnabled(address _unit) {
    uint256 _collateralRatio;
    uint256 _maxCapital;
    // (_collateralRatio, _maxCapital) = this.getEnabledCurrency(_unit);
    // require((dataUint256[__a(_unit, "collateralRatio")] > 0) && (dataUint256[__a(_unit, "maxCapital")] > 0));
    require((_collateralRatio > 0) && (_maxCapital > 0));
    _;
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
//  _assertHasEnoughBalance (_unit, _limit)
  {
    // check currency is enabled
    // check role (same as normal policy)
    // check available balance (collateralRatio + limit)
    // 




    uint256 policyNumber = dataUint256["numSimplePolicies"];
    //forward and reverse lookups
    dataUint256[__b (_id, "simplePolicyNumber")] = policyNumber;
    dataBytes32[__i (policyNumber, "simplePolicyNumber")] = _id;


    // ToDo
    // //Only bulk approve
    // if (_approvalSignatures.length = 4) {
    //   pol.bulkApprove(_approvalSignatures);
    // }

    // emit NewPolicy(pAddr, address(this), msg.sender);
  }
  

  //This is called from your entity to pay a claim on a policy in another entity.
  // It transfers the amount from your entity to the specified entity
  function paySimplePremium(bytes32 _id, address _entityAddress, uint256 _amount)
    external
    override
  {
    address policyUnitAddress;


  }

  function updateAllowSimplePolicy(
    bool _allow
  ) 
  external
  override
//  assertIsSystemManager (msg.sender)
  {
      dataBool["allowSimplePolicy"] = _allow;
  }

  function allowSimplePolicy() external override view returns (bool _allow)
  {
    return dataBool["allowSimplePolicy"];
  }


  function getNumSimplePolicies() external override view returns (uint256 _numPolicies)
  {

  }

  function getSimplePolicyId (uint256 _simplePolicyNumber) public view override returns (bytes32 _id )
  {

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

  }

  function paySimpleClaim (bytes32 _id, uint256 _amount) external override view
  {
    // nayms system manager can only do this
    //remaining funds must be less than the claim and then they are deducted
  }


  function checkAndUpdateState (bytes32 _id ) external override 
  {

  }

  //to be determined
  function verifySimplePolicy (bytes32 _id ) external override 
  {

  }
}

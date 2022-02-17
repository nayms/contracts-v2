// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

//import "./base/Controller.sol";
import "./base/EternalStorage.sol";
//import "./EntityFacetBase.sol";
// import "./base/IEntityCoreFacet.sol";
import "./base/IEntitySimplePolicyFacet.sol";
import "./base/ISimplePolicyStates.sol";
import "./base/IDiamondFacet.sol";
// import "./base/IParent.sol";
// import "./base/IERC20.sol";
// import "./base/IMarket.sol";
import "./base/SafeMath.sol";
// import "./Policy.sol";

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
  

  function paySimplePremium(bytes32 _id, uint256 _amount)
    external
    override
  {
    address policyUnitAddress;


    // avoid stack too deep errors
    {
      uint256 i1;
      uint256 i2;
      uint256 i3;
      address a1;

      // policy's unit
      // (, a1, i1, i2, i3, policyUnitAddress, , ,) = p.getInfo();
    }
    
    // check balance
    // _assertHasEnoughBalance(policyUnitAddress, _amount);

    // // approve transfer
    // IERC20 tok = IERC20(policyUnitAddress);
    // tok.approve(_id, _amount);

    // do it
    // p.payTranchePremium(_trancheIndex, _amount);
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

  function payPremium (bytes32 _id, uint256 _amount) external override view
  {

  }


  function checkAndUpdateState (bytes32 _id ) external override 
  {

  }

  function verifySimplePolicy (bytes32 _id ) external override 
  {

  }
}

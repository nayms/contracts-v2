// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./EntityFacetBase.sol";
import "./base/IEntityCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IParent.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/IPolicy.sol";
import "./base/SafeMath.sol";
import "./Policy.sol";

contract EntityCoreFacet is EternalStorage, Controller, EntityFacetBase, IEntityCoreFacet, IDiamondFacet {
  using SafeMath for uint256;

  modifier assertCanPayTranchePremiums (address _policyAddress) {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_REPS), 'must be entity rep');
    _;
  }

  modifier assertPolicyCreationEnabled () {
    require(this.allowPolicy(), 'policy creation disabled');
    _;
  }

  // modifier assertSimplePolicyCreationEnabled () {
  //   require(this.allowSimplePolicy(), 'simple policy creation disabled');
  //   _;
  // }

  modifier assertCurrencyIsEnabled(address _unit) {
    uint256 _collateralRatio;
    uint256 _maxCapital;
    (_collateralRatio, _maxCapital) = this.getEnabledCurrency(_unit);
    require((_collateralRatio > 0) && (_maxCapital > 0));
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityCoreFacet.createPolicy.selector,
      IEntityCoreFacet.payTranchePremium.selector,
      IEntityCoreFacet.updateEnabledCurrency.selector,
      IEntityCoreFacet.getEnabledCurrency.selector,
      IEntityCoreFacet.getEnabledCurrencies.selector,
      IEntityCoreFacet.updateAllowPolicy.selector,
      IEntityCoreFacet.allowPolicy.selector,
      IParent.getNumChildren.selector,
      IParent.getChild.selector,
      IParent.hasChild.selector
    );
  }


  // IEntityCoreFacet

  function createPolicy(
    bytes32 _id,
    uint256[] calldata _typeAndDatesAndCommissionsBP,
    address[] calldata _unitAndTreasuryAndStakeholders,
    uint256[][] calldata _trancheData,
    bytes[] calldata _approvalSignatures
  ) 
  external 
  override 
  assertPolicyCreationEnabled
  {
    require(
      IAccessControl(_unitAndTreasuryAndStakeholders[3]).aclContext() == aclContext(),
      "underwriter ACL context must match"
    );

    Policy f = new Policy(
      _id,
      address(settings()),
      msg.sender,
      _typeAndDatesAndCommissionsBP,
      _unitAndTreasuryAndStakeholders
    );

    address pAddr = address(f);
    _addChild(pAddr);

    IPolicy pol = IPolicy(pAddr);

    uint256 numTranches = _trancheData.length;

    for (uint256 i = 0; i < numTranches; i += 1) {
      uint256 trancheDataLength = _trancheData[i].length;
      uint256[] memory premiums = new uint256[](trancheDataLength - 2);

      for (uint256 j = 2; j < trancheDataLength; ++j) {
        premiums[j - 2] = _trancheData[i][j];
      }

      pol.createTranche(
        _trancheData[i][0], // _numShares
        _trancheData[i][1], // _pricePerShareAmount
        premiums
      );
    }

    if (_approvalSignatures.length > 0) {
      pol.bulkApprove(_approvalSignatures);
    }

    emit NewPolicy(pAddr, address(this), msg.sender);
  }
  

  function payTranchePremium(address _policy, uint256 _trancheIndex, uint256 _amount)
    external
    override
    assertCanPayTranchePremiums(_policy)
  {
    address policyUnitAddress;

    IPolicy p = IPolicy(_policy);

    // avoid stack too deep errors
    {
      uint256 i1;
      uint256 i2;
      uint256 i3;
      address a1;

      // policy's unit
      (, a1, i1, i2, i3, policyUnitAddress, , ,) = p.getInfo();
    }
    
    // check balance
    _assertHasEnoughBalance(policyUnitAddress, _amount);

    // approve transfer
    IERC20 tok = IERC20(policyUnitAddress);
    tok.approve(_policy, _amount);

    // do it
    p.payTranchePremium(_trancheIndex, _amount);
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
        if (!(dataManyAddresses["enabledUnits"][j] == _unit)){
          newUnits[unitIndex] = (dataManyAddresses["enabledUnits"][j]);
          unitIndex ++;
        }
      }
      dataManyAddresses["enabledUnits"] = newUnits;
    }
    else
    // add or update unit 
    {
      if (_collateralRatio > 100){
        revert("collateral ratio is 0-100");
      }

      for (uint256 j = 0; j < dataManyAddresses["enabledUnits"].length; j += 1) {
        if (dataManyAddresses["enabledUnits"][j] == _unit){
          hasUnit = true;
        }
      }
      if (!hasUnit){
        unitIndex = dataManyAddresses["enabledUnits"].length;
        dataManyAddresses["enabledUnits"][unitIndex] = _unit;
      }

    }

    //Either way, update the values
    dataUint256[__a(_unit, "maxCapital")] = _maxCapital;
    dataUint256[__a(_unit, "collateralRatio")] = _collateralRatio;
  }

  function getEnabledCurrency(address _unit) external override view returns (uint256 _collateralRatio, uint256 _maxCapital)
  {
    _collateralRatio = dataUint256[__a(_unit, "collateralRatio")];
    _maxCapital = dataUint256[__a(_unit, "maxCapital")];
  }

  function getEnabledCurrencies() external override view returns (address[] memory)
  {
    return dataManyAddresses["enabledUnits"];
  }

  function updateAllowPolicy(
    bool _allow
  )
  external
  override
  assertIsSystemManager (msg.sender)
  {
      dataBool["allowPolicy"] = _allow;
  }

  function allowPolicy() external override view returns (bool _allow)
  {
    return dataBool["allowPolicy"];
  }

}

// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IMarket.sol";
import "./base/Parent.sol";
import "./base/IMarketFeeSchedules.sol";
import "./base/IERC20.sol";

/**
 * @dev Entity facet base class
 */
abstract contract EntityFacetBase is EternalStorage, Controller, IMarketFeeSchedules, Parent {
  modifier assertIsEntityAdmin (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_ENTITY_ADMINS), 'must be entity admin');
    _;
  }

  modifier assertIsSystemManager (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_SYSTEM_MANAGERS), 'must be system mgr');
    _;
  }

  modifier assertIsMyPolicy(address _addr) {
    require(hasChild(_addr), 'not my policy');
    _;
  }

  function _assertHasEnoughBalance (address _unit, uint256 _amount) internal view {
    require(dataUint256[__a(_unit, "balance")] >= _amount, 'exceeds entity balance');
  }

  function _assertNoTokenSaleInProgress () internal view {
    require(dataUint256["tokenSaleOfferId"] == 0, "token sale in progress");
  }

  function _tradeOnMarket(
    address _sellUnit, 
    uint256 _sellAmount, 
    address _buyUnit, 
    uint256 _buyAmount,
    uint256 _feeSchedule,
    address _notify,
    bytes memory _notifyData
  ) internal returns (uint256) {
    // get mkt
    IMarket mkt = _getMarket();
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_sellUnit);
    tok.approve(address(mkt), _sellAmount);
    // make the offer
    return mkt.executeLimitOffer(_sellUnit, _sellAmount, _buyUnit, _buyAmount, _feeSchedule, _notify, _notifyData);
  }  

  function _sellAtBestPriceOnMarket(address _sellUnit, uint256 _sellAmount, address _buyUnit) internal {
    IMarket mkt = _getMarket();
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_sellUnit);
    tok.approve(address(mkt), _sellAmount);
    // make the offer
    mkt.executeMarketOffer(_sellUnit, _sellAmount, _buyUnit);
  }  

  function _getMarket () internal view returns (IMarket) {
    return IMarket(settings().getRootAddress(SETTING_MARKET));
  }

  function updateEnabledCurrency(
    address _unit,
    uint256 _collateralRatio,
    uint256 _maxCapital
  )
  external
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

  function getEnabledCurrencies() external view returns (address[] memory)
  {
    return dataManyAddresses["enabledUnits"];
  }

  function getEnabledCurrency(address _unit) external view returns (uint256 _collateralRatio, uint256 _maxCapital)
  {
    _collateralRatio = dataUint256[__a(_unit, "collateralRatio")];
    _maxCapital = dataUint256[__a(_unit, "maxCapital")];
  }
}

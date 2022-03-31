// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

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

  function _assertNoTokenSaleInProgress (address _unit) internal view {
    require(dataUint256[__a(_unit, "tokenSaleOfferId")] == 0, "token sale in progress");
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

}

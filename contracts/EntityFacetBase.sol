pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IMarket.sol";
import "./base/ITreasury.sol";
import "./base/IERC20.sol";

/**
 * @dev Entity facet base class
 */
abstract contract EntityFacetBase is EternalStorage, Controller {
  modifier assertIsEntityAdmin (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_ENTITY_ADMINS), 'must be entity admin');
    _;
  }

  modifier assertIsMyPolicy(address _addr) {
    require(_isPolicyCreatedByMe(_addr), 'not my policy');
    _;
  }

  function _assertHasEnoughBalance (address _unit, uint256 _amount) internal view {
    require(dataUint256[__a(_unit, "balance")] >= _amount, 'exceeds entity balance');
  }

  function _decBalance (address _unit, uint256 _amount) internal {
    _assertHasEnoughBalance(_unit, _amount);    
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].sub(_amount);
  }

  function _isPolicyCreatedByMe(address _policy) internal view returns (bool) {
    return dataBool[__a(_policy, "isPolicy")];
  }

  function _tradeOnMarket(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount) internal returns (uint256) {
    // reduce my balance
    _decBalance(_payUnit, _payAmount);

    // get mkt
    IMarket mkt = _getMarket();
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_payUnit);
    tok.approve(address(mkt), _payAmount);
    // make the offer
    return mkt.offer(_payAmount, _payUnit, _buyAmount, _buyUnit, 0, false);
  }  

  function _sellAtBestPriceOnMarket(address _sellUnit, uint256 _sellAmount, address _buyUnit) internal returns (uint256) {
    IMarket mkt = _getMarket();
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_sellUnit);
    tok.approve(address(mkt), _sellAmount);
    // make the offer
    return mkt.sellAllAmount(_sellUnit, _sellAmount, _buyUnit, _sellAmount);
  }  

  function _getMarket () internal view returns (IMarket) {
    return IMarket(settings().getRootAddress(SETTING_MARKET));
  }

  function _getTreasury () internal view returns (ITreasury) {
    return ITreasury(settings().getRootAddress(SETTING_TREASURY));
  }
}

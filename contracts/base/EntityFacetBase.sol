pragma solidity >=0.6.7;

import "./EternalStorage.sol";
import "./Controller.sol";
import "./IMarket.sol";
import "./IERC20.sol";

/**
 * @dev Entity facet base class
 */
abstract contract EntityFacetBase is EternalStorage, Controller {
  modifier assertIsPolicyCreatedByMe(address _addr) {
    require(_isPolicyCreatedByMe(_addr), 'not my policy');
    _;
  }

  function _isPolicyCreatedByMe(address _policy) internal view returns (bool) {
    return dataBool[__a(_policy, "isPolicy")];
  }

  function _tradeOnMarket(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount) internal returns (uint256) {
    // get mkt
    address mktAddress = settings().getRootAddress(SETTING_MARKET);
    IMarket mkt = IMarket(mktAddress);
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_payUnit);
    tok.approve(mktAddress, _payAmount);
    // make the offer
    return mkt.offer(_payAmount, _payUnit, _buyAmount, _buyUnit, 0, false);
  }  

  function _sellAtBestPriceOnMarket(address _sellUnit, uint256 _sellAmount, address _buyUnit) internal returns (uint256) {
    // get mkt
    address mktAddress = settings().getRootAddress(SETTING_MARKET);
    IMarket mkt = IMarket(mktAddress);
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_sellUnit);
    tok.approve(mktAddress, _sellAmount);
    // make the offer
    return mkt.sellAllAmount(_sellUnit, _sellAmount, _buyUnit, _sellAmount);
  }  
}

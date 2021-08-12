pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";

/**
 * @dev Market facet base class
 */
abstract contract MarketFacetBase is EternalStorage, Controller {
  function _getBestOfferId(address _sellToken, address _buyToken) internal view returns (uint256) {
    return dataUint256[__iaa(0, _sellToken, _buyToken, "bestOfferId")];
  }  
}

pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/Utils.sol";
import "./base/SafeMath.sol";

/**
 * @dev Market facet base class
 */
abstract contract MarketFacetBase is EternalStorage, Controller {
  using SafeMath for uint256;

  struct TokenAmount {
    address token;
    uint256 amount;
  }

  function _getFeeBank () internal view returns (address) {
    return settings().getRootAddress(SETTING_FEEBANK);
  }

  function _getBestOfferId(address _sellToken, address _buyToken) internal view returns (uint256) {
    return dataUint256[__iaa(0, _sellToken, _buyToken, "bestOfferId")];
  }  

  function _calculateFee(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount
  ) internal view returns (TokenAmount memory fee_) {
    // are we selling a platform token
    bool sellTokenIsPlatformToken = Utils.isNaymsPlatformToken(_sellToken);
    bool buyTokenIsPlatformToken = Utils.isNaymsPlatformToken(_buyToken);

    // XOR: trade is valid iff one token is platform token
    require(
      (sellTokenIsPlatformToken || buyTokenIsPlatformToken) && !(sellTokenIsPlatformToken && buyTokenIsPlatformToken), 
      "only platform tokens supported"
    );

    uint256 feeBP = dataUint256["feeBP"];

    if (sellTokenIsPlatformToken) {
      fee_.token = _buyToken;
      fee_.amount = feeBP.mul(_buyAmount).div(10000);
    } else {
      fee_.token = _sellToken;
      fee_.amount = feeBP.mul(_sellAmount).div(10000);
    }
  }
}

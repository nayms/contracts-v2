// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/IMarketFeeSchedules.sol";
import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/Utils.sol";

/**
 * @dev Market facet base class
 */
abstract contract MarketFacetBase is EternalStorage, Controller, IMarketFeeSchedules {

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

  function _getOfferTokenAmounts(uint256 _offerId) internal view returns (TokenAmount memory sell_, TokenAmount memory buy_) {
    sell_.token = dataAddress[__i(_offerId, "sellToken")];
    sell_.amount = dataUint256[__i(_offerId, "sellAmount")];
    buy_.token = dataAddress[__i(_offerId, "buyToken")];
    buy_.amount = dataUint256[__i(_offerId, "buyAmount")];
  }

  function _calculateFee(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount,
    uint256 _feeSchedule
  ) internal view returns (TokenAmount memory fee_) {
    // are we selling a platform token
    bool sellTokenIsPlatformToken = Utils.isNaymsPlatformToken(_sellToken);
    bool buyTokenIsPlatformToken = Utils.isNaymsPlatformToken(_buyToken);

    // XOR: trade is valid iff one token is platform token
    require(
      (sellTokenIsPlatformToken || buyTokenIsPlatformToken) && !(sellTokenIsPlatformToken && buyTokenIsPlatformToken), 
      "must be one platform token"
    );

    uint256 feeBP = dataUint256["feeBP"];

    if (sellTokenIsPlatformToken) {
      fee_.token = _buyToken;
      fee_.amount = feeBP * _buyAmount / 10000;
    } else {
      fee_.token = _sellToken;
      fee_.amount = feeBP * _sellAmount / 10000;
    }

    // if fee schedule is "platform action" then no fee is to be charged
    if (_feeSchedule == FEE_SCHEDULE_PLATFORM_ACTION) {
      fee_.amount = 0;
    }
  }

  // These are from https://github.com/nayms/maker-otc/blob/master/contracts/math.sol
  function wdiv(uint x, uint y) internal pure returns (uint z) {
    z = ((x * 10 ** 18) + (y / 2)) / y;
  }
}

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";

contract Market is Controller, DiamondProxy {
  constructor (address _settings) Controller(_settings) DiamondProxy() public {
    _registerFacets(settings().getRootAddresses(SETTING_MARKET_IMPL));

    /*
    * Minimum sell amount for a token - used to avoid "dust" offers that have very small amount of tokens to sell whereby it
    * would cost more gas to accept the offer than the value of the tokens received
    */
    dataUint256["dust"] = 1;
  }
}

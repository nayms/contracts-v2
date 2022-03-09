// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;


import "./base/Controller.sol";
import "./base/DiamondProxy.sol";

contract FeeBank is Controller, DiamondProxy {
  constructor (address _settings) Controller(_settings) DiamondProxy() public {
    _registerFacets(settings().getRootAddresses(SETTING_FEEBANK_IMPL));
  }
}

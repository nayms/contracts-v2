pragma solidity 0.6.12;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IMarketCoreFacet.sol";
import "./IMarketDataFacet.sol";

abstract contract IMarket is 
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IMarketCoreFacet,
  IMarketDataFacet
  {}

pragma solidity 0.6.12;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IMarketCoreFacet.sol";
import "./IMarketConfigFacet.sol";

abstract contract IMarket is 
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IMarketCoreFacet,
  IMarketConfigFacet
  {}

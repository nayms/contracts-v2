pragma solidity 0.6.12;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IMarketCoreFacet.sol";

interface IMarket is 
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IMarketCoreFacet
  {}

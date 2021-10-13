// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IFeeBankCoreFacet.sol";

abstract contract IFeeBank is 
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IFeeBankCoreFacet
  {}

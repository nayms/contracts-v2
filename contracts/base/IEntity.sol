// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IEntityCoreFacet.sol";
import "./IEntityTokensFacet.sol";
import "./IEntityDividendsFacet.sol";
import "./IEntityTreasuryBridgeFacet.sol";
import "./IPolicyTreasury.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IEntity is
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IEntityCoreFacet,
  IEntityTokensFacet,
  IEntityDividendsFacet,
  IEntityTreasuryBridgeFacet,
  IPolicyTreasury
  {}

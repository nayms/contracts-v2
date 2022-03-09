// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
pragma experimental ABIEncoderV2;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IParent.sol";
import "./IChild.sol";
import "./IEntityCoreFacet.sol";
import "./IEntityFundingFacet.sol";
import "./IEntityTokensFacet.sol";
import "./IEntityDividendsFacet.sol";
import "./IEntityTreasuryBridgeFacet.sol";
import "./IPolicyTreasury.sol";
import "./IEntitySimplePolicyCoreFacet.sol";
import "./IEntitySimplePolicyDataFacet.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IEntity is
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IParent,
  IChild,
  IEntityCoreFacet,
  IEntityFundingFacet,
  IEntityTokensFacet,
  IEntityDividendsFacet,
  IEntityTreasuryBridgeFacet,
  IPolicyTreasury,
  IEntitySimplePolicyCoreFacet,
  IEntitySimplePolicyDataFacet
  {}

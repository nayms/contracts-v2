pragma solidity >=0.6.7;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IEntityCoreFacet.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IEntity is
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IEntityCoreFacet
  {}

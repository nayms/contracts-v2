pragma solidity >=0.6.7;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IEntityCoreFacet.sol";
import "./IEntityTokenImplFacet.sol";
import "./IEntityTokenMinterFacet.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IEntity is
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IEntityCoreFacet,
  IEntityTokenImplFacet,
  IEntityTokenMinterFacet
  {}

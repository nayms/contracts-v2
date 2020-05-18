pragma solidity >=0.6.7;

import "./IDiamondUpgradeFacet.sol";
import "./IEntityCoreFacet.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IEntity is
  IDiamondUpgradeFacet,
  IEntityCoreFacet
  {}

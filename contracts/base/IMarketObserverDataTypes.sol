// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @dev Type constants for market observer extra metadata.
 */
abstract contract IMarketObserverDataTypes {
  /**
   * @dev Tranche token initial sale
   */
  uint256 constant public MODT_TRANCHE_SALE = 1;
  /**
   * @dev Tranche token buyback
   */
  uint256 constant public MODT_TRANCHE_BUYBACK = 2;
  /**
   * @dev Entity token sale
   */
  uint256 constant public MODT_ENTITY_SALE = 3;
}

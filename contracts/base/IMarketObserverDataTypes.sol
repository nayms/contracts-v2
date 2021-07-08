pragma solidity 0.6.12;

/**
 * @dev Type constants for market observer extra metadata.
 */
abstract contract IMarketObserverDataTypes {
  /**
   * @dev Tranch token initial sale
   */
  uint256 constant public MODT_TRANCH_SALE = 1;
  /**
   * @dev Tranch token buyback
   */
  uint256 constant public MODT_TRANCH_BUYBACK = 2;
  /**
   * @dev Entity token sale
   */
  uint256 constant public MODT_ENTITY_SALE = 3;
}

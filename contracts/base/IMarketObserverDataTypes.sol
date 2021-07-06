pragma solidity 0.6.12;

/**
 * @dev Type constants for market observer extra metadata.
 */
abstract contract IMarketObserverDataTypes {
  /**
   * @dev State: Tranch token initial sale
   */
  uint256 constant public MODT_TRANCH_SALE = 1;
  /**
   * @dev State: Tranch token buyback
   */
  uint256 constant public MODT_TRANCH_BUYBACK = 1;
}

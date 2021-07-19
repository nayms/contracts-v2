pragma solidity 0.6.12;

/**
 * @dev Super-interface for dummy market observer
 */
abstract contract IDummyMarketObserver {
  /**
   * @dev Get order details.
   *
   * @param orderId The order id.
   * @return orderType trade or closure
   */
  function getOrder(uint256 orderId) external virtual returns (string memory orderType);
}

// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/**
 * @dev Super-interface for dummy market observer
 */
abstract contract IDummyMarketObserver {
  enum ORDER_TYPE{NONE, TRADE, CLOSURE}
  
  event TRADE(uint256 orderId);
  event CLOSURE(uint256 orderId);

  /**
   * @dev Get order details.
   *
   * @param orderId The order id.
   * @return _type trade or closure.
   * @return _data passed optional data.
   */
  function getOrder(uint256 orderId) external view virtual returns (ORDER_TYPE _type, bytes memory _data);
}

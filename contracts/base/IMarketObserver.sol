// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/**
 * A `IMarket` observer which receives notifications of trades and cancellations.
 */
abstract contract IMarketObserver {
  /**
   * @dev Handle a trade notification.
   *
   * @param _offerId Order id.
   * @param _soldAmount Amount sold.
   * @param _boughtAmount Amount bought.
   * @param _feeToken Fee token.
   * @param _feeAmount Fee paid.
   * @param _buyer Order buyer.
   * @param _data Extra metadata that is being passed through.
   */
  function handleTrade(
    uint256 _offerId,
    uint256 _soldAmount, 
    uint256 _boughtAmount,
    address _feeToken, 
    uint256 _feeAmount,
    address _buyer,
    bytes memory _data
  ) external virtual {}

  /**
   * @dev Handle an order cancellation or closure.
   *
   * @param _offerId Order id.
   * @param _unsoldAmount Amount remaining unsold.
   * @param _unboughtAmount Amount remaining unbought.
   * @param _data Extra metadata that is being passed through.
   */
  function handleClosure(
    uint256 _offerId,
    uint256 _unsoldAmount, 
    uint256 _unboughtAmount,
    bytes memory _data
  ) external virtual {}
}

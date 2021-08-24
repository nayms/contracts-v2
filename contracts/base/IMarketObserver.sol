pragma solidity 0.6.12;

/**
 * A `IMarket` observer which receives notifications of trades and cancellations.
 */
abstract contract IMarketObserver {
  /**
   * @dev Handle a trade notification.
   *
   * @param _offerId Order id.
   * @param _sellToken Token sold.
   * @param _soldAmount Amount sold.
   * @param _buyToken Token bought.
   * @param _boughtAmount Amount bought.
   * @param _feeToken Fee token.
   * @param _feeAmount Fee paid.
   * @param _seller Order seller.
   * @param _buyer Order buyer.
   * @param _data Extra metadata that is being passed through.
   */
  function handleTrade(
    uint256 _offerId,
    address _sellToken, 
    uint256 _soldAmount, 
    address _buyToken, 
    uint256 _boughtAmount,
    address _feeToken, 
    uint256 _feeAmount,
    address _seller,
    address _buyer,
    bytes memory _data
  ) external virtual {}

  /**
   * @dev Handle an order cancellation or closure.
   *
   * @param _offerId Order id.
   * @param _sellToken Token sold.
   * @param _unsoldAmount Amount remaining unsold.
   * @param _buyToken Token bought.
   * @param _unboughtAmount Amount remaining unbought.
   * @param _seller Order seller.
   * @param _data Extra metadata that is being passed through.
   */
  function handleClosure(
    uint256 _offerId,
    address _sellToken, 
    uint256 _unsoldAmount, 
    address _buyToken, 
    uint256 _unboughtAmount,
    address _seller,
    bytes memory _data
  ) external virtual {}
}

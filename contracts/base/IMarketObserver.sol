pragma solidity 0.6.12;

/**
 * A `IMarket` observer which receives notifications of trades and cancellations.
 */
interface IMarketObserver {
  /**
   * @dev Handle a trade notification.
   *
   * @param _offerId Order id.
   * @param _sellToken Token sold.
   * @param _soldAmount Amount sold.
   * @param _buyToken Token bought.
   * @param _boughtAmount Amount bought.
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
    address _seller,
    address _buyer,
    string memory _data
  ) external;

  /**
   * @dev Handle an order cancellation.
   *
   * @param _offerId Order id.
   * @param _sellToken Token sold.
   * @param _unsoldAmount Amount remaining unsold.
   * @param _buyToken Token bought.
   * @param _unboughtAmount Amount remaining unbought.
   * @param _seller Order seller.
   * @param _data Extra metadata that is being passed through.
   */
  function handleCancellation(
    uint256 _offerId,
    address _sellToken, 
    uint256 _unsoldAmount, 
    address _buyToken, 
    uint256 _unboughtAmount,
    address _seller,
    string memory _data
  ) external;
}

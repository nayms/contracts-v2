pragma solidity 0.6.12;

interface IMarketCoreFacet {
  /**
   * @dev Execute a limit offer.
   *
   * @param _sellToken token to sell.
   * @param _sellAmount amount to sell.
   * @param _buyToken token to buy.
   * @param _buyAmount Amount to buy.
   *
   * @return >0 if a limit offer was created on the market because the offer couldn't be totally fulfilled immediately. In this case the 
   * return value is the created offer's id.
   */
  function executeLimitOffer(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount
  ) external returns (uint256);

  /**
   * @dev Execute a limit offer with an observer attached.
   *
   * The observer must implement `IMarketObserver`. It will be notified when the order 
   * trades and/or gets cancelled.
   * 
   * @param _sellToken token to sell.
   * @param _sellAmount amount to sell.
   * @param _buyToken token to buy.
   * @param _buyAmount Amount to buy.
   * @param _notify `IMarketObserver` to notify when a trade takes place and/or order gets cancelled.
   * @param _notifyData Data to pass through to the notified contract.
   *
   * @return >0 if a limit offer was created on the market because the offer couldn't be totally fulfilled immediately. In this case the 
   * return value is the created offer's id.
   */
  function executeLimitOfferWithObserver(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount,
    address _notify,
    string memory _notifyData
  ) external returns (uint256);

  /**
   * @dev Execute a market offer, ensuring the full amount gets sold.
   *
   * This will revert if the full amount could not be sold.
   *
   * @param _sellToken token to sell.
   * @param _sellAmount amount to sell.
   * @param _buyToken token to buy.
   */
  function executeMarketOffer(address _sellToken, uint256 _sellAmount, address _buyToken) external;
  
  /**
   * @dev Buy an offer
   *
   * @param _offerId offer id.
   * @param _amount amount (upto the offer's `buyAmount`) of offer's `buyToken` to buy with.
   */
  function buy(uint256 _offerId, uint256 _amount) external;

  /**
   * @dev Cancel an offer.
   *
   * This will revert the offer is not longer active. 
   *
   * @param _offerId offer id.
   */
  function cancel(uint256 _offerId) external;

  /**
   * @dev Get current best offer for given token pair.
   *
   * This means finding the highest sellToken-per-buyToken price, i.e. price = sellToken / buyToken
   *
   * @return offer id, or 0 if no current best is available.
   */
  function getBestOfferId(address _sellToken, address _buyToken) external view returns (uint256);

  /**
   * @dev Get last created offer.
   *
   * @return offer id.
   */
  function getLastOfferId() external view returns (uint256);

  /**
   * @dev Check if offer is active.
   *
   * @param _offerId offer id.
   *
   * @return true if active, false otherwise.
   */
  function isActive(uint256 _offerId) external view returns (bool);

  /**
   * @dev Get offer details.
   *
   * @param _offerId offer id.
   *
   * @return creator_ owner/creator.
   * @return sellToken_ sell token.
   * @return sellAmount_ sell amount.
   * @return buyToken_ buy token.
   * @return buyAmount_ buy amount.
   * @return notify_ Contract to notify when a trade takes place and/or order gets cancelled.
   * @return notifyData_ Data to pass through to the notified contract.
   * @return isActive_ whether offer is active.
   * @return nextOfferId_ id of the next offer in the sorted list of offers for this token pair.
   * @return prevOfferId_ id of the previous offer in the sorted list of offers for this token pair.
   */
  function getOffer(uint256 _offerId) external view returns ( 
    address creator_,
    address sellToken_, 
    uint256 sellAmount_, 
    address buyToken_, 
    uint256 buyAmount_,
    address notify_,
    string memory notifyData_,
    bool isActive_,
    uint256 nextOfferId_,
    uint256 prevOfferId_
  );
}

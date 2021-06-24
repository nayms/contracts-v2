pragma solidity 0.6.12;

interface IMarketCoreFacet {
  /**
   * @dev Execute a limit offer.
   *
   * @return >0 if a limit offer was created on the market because the offer couldn't be totally fulfilled immediately. In this case the 
   * return value is the created offer's id.
   */
  function executeLimitOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) external returns (uint256);

  /**
   * @dev Execute a market offer, ensuring the full amount gets sold.
   *
   * This will revert if the full amount could not be sold.
   */
  function executeMarketOffer(address _sellToken, uint256 _sellAmount, address _buyToken) external;
  
  /**
   * @dev Cancel an offer.
   *
   * This will revert the offer is not longer active. 
   */
  function cancel(uint256 _offerId) external;

  /**
   * @dev Get current best offer for given token pair.
   *
   * This means finding the highest sellToken-per-buyToken price, i.e. price = sellToken / buyToken
   *
   * @return offer id, or 0 if no current best is available.
   */
  function getBestOffer(address _sellToken, address _buyToken) external view returns (uint256);

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
   * @return isActive_ whether offer is active.
   */
  function getOffer(uint256 _offerId) external view returns ( 
    address creator_,
    address sellToken_, 
    uint256 sellAmount_, 
    address buyToken_, 
    uint256 buyAmount_,
    bool isActive_,
    uint256 nextOfferId_,
    uint256 prevOfferId_
  );
}

pragma solidity 0.6.12;

interface IMarketDataFacet {
  /**
   * @dev Get market config.
   *
   * @return dust_ The dist value.
   * @return feeBP_ The fee value in basis points (1 point = 0.01%).
   */
  function getConfig() external view returns (
    uint256 dust_,
    uint256 feeBP_
  );

  /**
   * @dev Set market fee.
   *
   * @param _feeBP The fee value in basis points.
   */
  function setFee(uint256 _feeBP) external;

  /**
   * @dev Calculate the fee that must be paid for placing the given order.
   *
   * Assuming that the given order will be matched immediately to existing orders, 
   * this method returns the fee the caller will have to pay as a taker.
   *
   * @param _sellToken The sell unit.
   * @param _sellAmount The sell amount.
   * @param _buyToken The buy unit.
   * @param _buyAmount The buy amount.
   *
   * @return feeToken_ The unit in which the fees are denominated.
   * @return feeAmount_ The fee required to place the order.
   */
  function calculateFee(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount
  ) external view returns (address feeToken_, uint256 feeAmount_);

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
    bytes memory notifyData_,
    bool isActive_,
    uint256 nextOfferId_,
    uint256 prevOfferId_
  );
}
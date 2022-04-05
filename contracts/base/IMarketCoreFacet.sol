// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
interface IMarketCoreFacet {
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
     * @param _feeSchedule Requested fee schedule, one of the `FEE_SCHEDULE_...` constants.
     * @param _notify `IMarketObserver` to notify when a trade takes place and/or order gets cancelled.
     * @param _notifyData Data to pass through to the notified contract.
     *
     * @return >0 if a limit offer was created on the market because the offer couldn't be totally fulfilled immediately. In this case the
     * return value is the created offer's id.
     */
    function executeLimitOffer(
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken,
        uint256 _buyAmount,
        uint256 _feeSchedule,
        address _notify,
        bytes memory _notifyData
    ) external returns (uint256);

    /**
     * @dev Execute a market offer, ensuring the full amount gets sold.
     *
     * This will revert if the full amount could not be sold.
     *
     * @param _sellToken token to sell.
     * @param _sellAmount amount to sell.
     * @param _buyToken token to buy.
     *
     */
    function executeMarketOffer(
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken
    ) external;

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
}

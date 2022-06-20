// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Entity funding and trading.
 */
interface IEntityFundingFacet {
    /**
     * @dev Get balance.
     *
     * @param _unit Asset.
     */
    function getBalance(address _unit) external view returns (uint256);

    /**
     * @dev Deposit assets.
     *
     * The caller should ensure the entity has been pre-approved to transfer the asset on their behalf.
     *
     * @param _unit Asset to deposit.
     * @param _amount Amount to deposit.
     */
    function deposit(address _unit, uint256 _amount) external;

    /**
     * @dev Withdraw assets.
     *
     * The caller will recieved the withdrawn assets.
     *
     * @param _unit Asset to withdraw.
     * @param _amount Amount to withdraw.
     */
    function withdraw(address _unit, uint256 _amount) external;

    /**
     * @dev Trade assets at a specific price-point.
     *
     * @param _payUnit Asset to sell.
     * @param _payAmount Amount to sell.
     * @param _buyUnit Asset to buy.
     * @param _buyAmount Amount to buy.
     *
     * @return Market offer id.
     */
    function trade(
        address _payUnit,
        uint256 _payAmount,
        address _buyUnit,
        uint256 _buyAmount
    ) external returns (uint256);

    /**
     * @dev Sell given asset at the best possible price.
     *
     * Note that this call only succeeds if the full amount (`_sellAmount`) can be sold.
     *
     * @param _sellUnit Asset to sell.
     * @param _sellAmount Amount to sell.
     * @param _buyUnit Asset to buy.
     */
    function sellAtBestPrice(
        address _sellUnit,
        uint256 _sellAmount,
        address _buyUnit
    ) external;

    /**
     * @dev Cancel offer
     *
     * @param _offerId The ID of offer to be cacnelled.
     */
    function cancelOffer(uint256 _offerId) external;

    /**
     * @dev Emitted when a deposit is made.
     * @param caller The caller.
     * @param unit The token deposited.
     * @param amount The amount deposited.
     */
    event EntityDeposit(address indexed caller, address indexed unit, uint256 indexed amount);

    /**
     * @dev Emitted when a withdrawal is made.
     * @param caller The caller.
     * @param unit The token withdrawn.
     * @param amount The amount withdrawn.
     */
    event EntityWithdraw(address indexed caller, address indexed unit, uint256 indexed amount);
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Entity tokens facet.
 */
interface IEntityTokensFacet {
    /**
     * @dev Get entity token info.
     *
     * @param _unit unit token address.
     *
     * @return tokenContract_ Token contract address.
     * @return currentTokenSaleOfferId_ Current token sale market offer id. If 0 then no sale is taking place.
     */
    function getTokenInfo(address _unit) external view returns (address tokenContract_, uint256 currentTokenSaleOfferId_);

    /**
     * @dev Burn the caller's entity tokens.
     *
     * The given entity tokens will be deducted from the caller's balance as well as the total entity token supply.
     *
     * @param _unit Unit token address.
     * @param _amount Amount to burn.
     */
    function burnTokens(address _unit, uint256 _amount) external;

    /**
     * @dev Mint new entity tokens and sell them on the market.
     *
     * The given amount will be minted and immediately put on sale via the market at the given price, in order to raise funds. If there is
     * already such a sale in progress on the market then this call will fail.
     *
     * @param _amount Amount to mint.
     * @param _priceUnit The token to trade entity tokens for.
     * @param _totalPrice The total price for the `_amount`, denominated in the `_priceUnit`.
     */
    function startTokenSale(
        uint256 _amount,
        address _priceUnit,
        uint256 _totalPrice
    ) external;

    /**
     * @dev Cancel previously started entity token sale.
     *
     * @param _unit Unit token address.
     *
     * If an entity token sale was initiated via a callt to `startTokenSale()` then that sale will be cancelled. Any unsold tokens will be
     * automatically burnt to ensure existing entity token holders don't get diluted.
     */
    function cancelTokenSale(address _unit) external;

    // Handlers for EntityToken

    // ERC-20 queries
    function tknName(address _unit) external view returns (string memory);

    function tknSymbol(address _unit) external view returns (string memory);

    function tknTotalSupply(address _unit) external view returns (uint256);

    function tknBalanceOf(address _unit, address _owner) external view returns (uint256);

    function tknAllowance(
        address _unit,
        address _spender,
        address _owner
    ) external view returns (uint256);

    // ERC-20 mutations
    function tknApprove(
        address _unit,
        address _spender,
        address _from,
        uint256 _value
    ) external;

    function tknTransfer(
        address _unit,
        address _operator,
        address _from,
        address _to,
        uint256 _value
    ) external;
}

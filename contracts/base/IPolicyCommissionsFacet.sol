// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @dev Policy commissions code.
 */
interface IPolicyCommissionsFacet {
    /**
     * @dev Payout commission balances.
     */
    function payCommissions() external;

    /**
     * @dev Get commission rates.
     *
     * @return brokerCommissionBP_ Broker commission basis points.
     * @return claimsAdminCommissionBP_ Claims admin commission basis points.
     * @return naymsCommissionBP_ Nayms commission basis points.
     * @return underwriterCommissionBP_ Underwriter commission basis points.
     */
    function getCommissionRates()
        external
        view
        returns (
            uint256 brokerCommissionBP_,
            uint256 claimsAdminCommissionBP_,
            uint256 naymsCommissionBP_,
            uint256 underwriterCommissionBP_
        );

    /**
     * @dev Get accumulated commission balances.
     *
     * Note that these balances do not include amounts that have already been paid out (see `payCommissions()`).
     *
     * @return brokerCommissionBalance_ Currently accumulated broker commission.
     * @return claimsAdminCommissionBalance_ Currently accumulated claims admin commission.
     * @return naymsCommissionBalance_ Currently accumulated Nayms commission.
     * @return underwriterCommissionBalance_ Currently accumulated underwriter commission.
     */
    function getCommissionBalances()
        external
        view
        returns (
            uint256 brokerCommissionBalance_,
            uint256 claimsAdminCommissionBalance_,
            uint256 naymsCommissionBalance_,
            uint256 underwriterCommissionBalance_
        );

    // events

    /**
     * @dev Emitted when commission balances have been paid out.
     *
     * @param claimsAdmin Entity that received the claims admin commission.
     * @param broker Entity that received the broker commission.
     * @param underwriter Entity that received the underwriter commission.
     */
    event PaidCommissions(address indexed claimsAdmin, address indexed broker, address indexed underwriter);
}

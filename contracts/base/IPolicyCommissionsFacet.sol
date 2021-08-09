pragma solidity 0.6.12;

/**
 * @dev Policy commissions code.
 */
interface IPolicyCommissionsFacet {
  /**
   * @dev Payout commission balances.
   */
  function payCommissions () external;

  /**
   * @dev Get accumulated commission balances.
   *
   * Note that these balances do not include amounts that have already been paid out (see `payCommissions()`).
   *
   * @return brokerCommissionBalance_ Currently accumulated broker commission.
   * @return claimsAdminCommissionBalance_ Currently accumulated capital provider commission.
   * @return naymsCommissionBalance_ Currently accumulated Nayms commission.
   * @return underwriterCommissionBalance_ Currently accumulated Underwriter commission.
   */
  function getCommissionBalances() external view returns (
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
   * @param caller The caller.
   */
  event PaidCommissions(address indexed claimsAdmin, address indexed broker, address indexed caller);
}

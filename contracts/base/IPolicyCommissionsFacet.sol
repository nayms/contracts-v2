pragma solidity >=0.6.7;

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
   * @return capitalProviderCommissionBalance_ Currently accumulated capital provider commission.
   * @return naymsCommissionBalance_ Currently accumulated Nayms commission.
   */
  function getCommissionBalances() external view returns (
    uint256 brokerCommissionBalance_,
    uint256 capitalProviderCommissionBalance_,
    uint256 naymsCommissionBalance_
  );

  // events

  /**
   * @dev Emitted when commission balances have been paid out.
   *
   * @param underwriter Entity that received the capital provider commission.
   * @param broker Entity that received the broker commission.
   * @param caller The caller.
   */
  event PaidCommissions(address indexed underwriter, address indexed broker, address indexed caller);
}

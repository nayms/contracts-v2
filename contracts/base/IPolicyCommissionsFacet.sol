pragma solidity 0.6.12;

/**
 * @dev Policy commissions code.
 */
interface IPolicyCommissionsFacet {
  /**
   * @dev Payout commission balances.
   *
   * @param _capitalProviderEntity Entity that will receive the capital provider commission.
   * @param _capitalProvider A valid capital provider.
   * @param _brokerEntity Entity that will receive the broker commission.
   * @param _broker A valid broker.
   */
  function payCommissions (
    address _capitalProviderEntity, address _capitalProvider,
    address _brokerEntity, address _broker
  ) external;

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
   * @param capitalProviderEntity Entity that received the capital provider commission.
   * @param brokerEntity Entity that received the broker commission.
   * @param caller The caller.
   */
  event PaidCommissions(address indexed capitalProviderEntity, address indexed brokerEntity, address indexed caller);
}

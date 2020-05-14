pragma solidity >=0.6.7;

/**
 * @dev Policy commissions code.
 */
interface IPolicyCommissions {
  /**
   * @dev Payout commission balances.
   *
   * @param _assetManagerEntity Entity that will receive the asset manager commission.
   * @param _assetManager A valid asset manager.
   * @param _brokerEntity Entity that will receive the broker commission.
   * @param _broker A valid broker.
   */
  function payCommissions (
    address _assetManagerEntity, address _assetManager,
    address _brokerEntity, address _broker
  ) external;

  // events

  /**
   * @dev Emitted when commission balances have been paid out.
   *
   * @param assetManagerEntity Entity that received the asset manager commission.
   * @param brokerEntity Entity that received the broker commission.
   * @param caller The caller.
   */
  event PaidCommissions(address indexed assetManagerEntity, address indexed brokerEntity, address indexed caller);
}

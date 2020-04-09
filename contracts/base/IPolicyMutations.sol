pragma solidity >=0.5.8;

/**
 * @dev Additional policy methods.
 */
interface IPolicyMutations {
  /**
   * @dev Make a claim.
   *
   * @param _index Tranch index.
   * @param _clientManagerEntity Entity that will receive the payout.
   * @param _amount Amount claimed.
   */
  function makeClaim (uint256 _index, address _clientManagerEntity, uint256 _amount) external;
  /**
   * @dev Approve a claim.
   *
   * @param _claimIndex Claim index.
   */
  function approveClaim (uint256 _claimIndex) external;
  /**
   * @dev Decline a claim.
   *
   * @param _claimIndex Claim index.
   */
  function declineClaim (uint256 _claimIndex) external;
  /**
   * @dev Payout all approved claims.
   */
  function payClaims() external;
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
   * @dev Emitted when a new claim has been created.
   *
   * @param tranchIndex The tranch index.
   * @param claimIndex The claim index.
   * @param caller The claim maker.
   */
  event NewClaim(uint256 indexed tranchIndex, uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim has been approved.
   *
   * @param claimIndex The claim index.
   * @param caller The claim approver.
   */
  event ClaimApproved(uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim has been declined.
   *
   * @param claimIndex The claim index.
   * @param caller The claim decliner.
   */
  event ClaimDeclined(uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when all approved claims have been paid out.
   *
   * @param caller The caller.
   */
  event PaidClaims(address indexed caller);
  /**
   * @dev Emitted when commission balances have been paid out.
   *
   * @param assetManagerEntity Entity that received the asset manager commission.
   * @param brokerEntity Entity that received the broker commission.
   * @param caller The caller.
   */
  event PaidCommissions(address indexed assetManagerEntity, address indexed brokerEntity, address indexed caller);
}

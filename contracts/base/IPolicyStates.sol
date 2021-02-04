pragma solidity >=0.6.7;

/**
 * @dev Policy states
 */
abstract contract IPolicyStates {
  /**
   * @dev State: The policy has just been created.
   */
  uint256 constant public POLICY_STATE_CREATED = 0;
  /**
   * @dev State: The policy initial sale is in progress.
   */
  uint256 constant public POLICY_STATE_INITIATED = 1;
  /**
   * @dev State: The policy initial sale has completed and it is now active.
   */
  uint256 constant public POLICY_STATE_ACTIVE = 2;
  /**
   * @dev State: The policy has matured.
   */
  uint256 constant public POLICY_STATE_MATURED = 3;
  /**
   * @dev State: The policy got cancelled.
   */
  uint256 constant public POLICY_STATE_CANCELLED = 4;
  /**
   * @dev State: The policy is undergoing approval.
   */
  uint256 constant public POLICY_STATE_IN_APPROVAL = 5;
  /**
   * @dev State: The policy is has been initiated, meaning all policy approvals have been obtained.
   */
  uint256 constant public POLICY_STATE_APPROVED = 6;

  /**
   * @dev State: The tranch has just been created.
   */
  uint256 constant public TRANCH_STATE_CREATED = 0;
  /**
   * @dev State: The tranch initial sale is in progress.
   */
  uint256 constant public TRANCH_STATE_SELLING = 1;
  /**
   * @dev State: The tranch initial sale has completed it is now active.
   */
  uint256 constant public TRANCH_STATE_ACTIVE = 2;
  /**
   * @dev State: The tranch has matured.
   */
  uint256 constant public TRANCH_STATE_MATURED = 3;
  /**
   * @dev State: The tranch has been cancelled.
   */
  uint256 constant public TRANCH_STATE_CANCELLED = 4;

  // events

  event PolicyStateUpdated (uint256 indexed state, address indexed caller);
  event TranchStateUpdated (uint256 indexed tranchIndex, uint256 indexed state, address indexed caller);
}

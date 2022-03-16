// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @dev Policy states
 */
abstract contract IPolicyStates {
  /**
   * @dev State: The policy has just been created.
   */
  uint256 constant public POLICY_STATE_CREATED = 0;
  /**
   * @dev State: The policy is undergoing approval.
   */
  uint256 constant public POLICY_STATE_IN_APPROVAL = 5;
  /**
   * @dev State: All policy approvals have been obtained.
   */
  uint256 constant public POLICY_STATE_APPROVED = 6;
  /**
   * @dev State: The policy initial sale is in progress.
   */
  uint256 constant public POLICY_STATE_INITIATED = 1;
  /**
   * @dev State: The policy initial sale has completed and it is now active.
   */
  uint256 constant public POLICY_STATE_ACTIVE = 2;
  /**
   * @dev State: The policy has matured, but there are pending claims.
   */
  uint256 constant public POLICY_STATE_MATURED = 3;
  /**
   * @dev State: Policy has matured, no pending claims, and shares are being bought back from the market.
   */
  uint256 constant public POLICY_STATE_BUYBACK = 7;
  /**
   * @dev State: Policy has matured, no pending blaims, and all shares have been bought back.
   */
  uint256 constant public POLICY_STATE_CLOSED = 8;
  /**
   * @dev State: The policy got cancelled.
   */
  uint256 constant public POLICY_STATE_CANCELLED = 4;

  /**
   * @dev State: The tranche has just been created.
   */
  uint256 constant public TRANCHE_STATE_CREATED = 0;
  /**
   * @dev State: The tranche initial sale is in progress.
   */
  uint256 constant public TRANCHE_STATE_SELLING = 1;
  /**
   * @dev State: The tranche initial sale has completed it is now active.
   */
  uint256 constant public TRANCHE_STATE_ACTIVE = 2;
  /**
   * @dev State: The tranche has matured.
   */
  uint256 constant public TRANCHE_STATE_MATURED = 3;
  /**
   * @dev State: The tranche has been cancelled.
   */
  uint256 constant public TRANCHE_STATE_CANCELLED = 4;

  // events

  event PolicyStateUpdated (uint256 indexed state, address indexed caller);
  event TrancheStateUpdated (uint256 indexed trancheIndex, uint256 indexed state, address indexed caller);
}

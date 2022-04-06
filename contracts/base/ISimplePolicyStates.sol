// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Policy states
 */
abstract contract ISimplePolicyStates {
    /**
     * @dev State: The policy has just been created.
     */
    uint256 public constant POLICY_STATE_CREATED = 0;
    /**
     * @dev State: The policy initial sale has completed and it is now active.
     */
    uint256 public constant POLICY_STATE_ACTIVE = 2;
    /**
     * @dev State: The policy has matured, but there are pending claims.
     */
    uint256 public constant POLICY_STATE_MATURED = 3;
    /**
     * @dev State: The policy got cancelled.
     */
    uint256 public constant POLICY_STATE_CANCELLED = 4;

    // events
    event SimplePolicyStateUpdated(bytes32 id, uint256 indexed state, address indexed caller);
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Simple Policy heartbeat methods.
 */
interface ISimplePolicyHeartbeatFacet {
    /**
     * @dev Ensure that the policy state is up-to-date.
     */
    function checkAndUpdateState() external returns (bool reduceTotalLimit_);
}

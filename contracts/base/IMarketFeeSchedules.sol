// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
/**
 * @dev Market fee schedules
 */
abstract contract IMarketFeeSchedules {
    /**
     * @dev Standard fee is charged.
     */
    uint256 public constant FEE_SCHEDULE_STANDARD = 1;
    /**
     * @dev Platform-initiated trade, e.g. token sale or buyback.
     */
    uint256 public constant FEE_SCHEDULE_PLATFORM_ACTION = 2;
}

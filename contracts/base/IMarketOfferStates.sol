// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
/**
 * @dev Type constants for market offer states.
 */
abstract contract IMarketOfferStates {
    /**
     * @dev Offer is active
     */
    uint256 public constant OFFER_STATE_ACTIVE = 1;
    /**
     * @dev Offer is cancelled
     */
    uint256 public constant OFFER_STATE_CANCELLED = 2;
    /**
     * @dev Offer is fulfilled
     */
    uint256 public constant OFFER_STATE_FULFILLED = 3;
}

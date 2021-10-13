// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/**
 * @dev Type constants for market offer states.
 */
abstract contract IMarketOfferStates {
  /**
   * @dev Offer is active
   */
  uint256 constant public OFFER_STATE_ACTIVE = 1;
  /**
   * @dev Offer is cancelled
   */
  uint256 constant public OFFER_STATE_CANCELLED = 2;
  /**
   * @dev Offer is fulfilled
   */
  uint256 constant public OFFER_STATE_FULFILLED = 3;
}

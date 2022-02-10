// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/**
 * @dev Policy types
 */
abstract contract IPolicyTypes {
  /**
   * @dev SPV-based policy that has tranche tokens.
   */
  uint256 constant public POLICY_TYPE_SPV = 0;
  /**
   * @dev Policy is part of an underwriter's portfolio and does not issue tranche tokens.
   */
  uint256 constant public POLICY_TYPE_PORTFOLIO = 1;
}
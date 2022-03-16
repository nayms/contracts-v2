// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./IERC20.sol";

/**
 * @dev Super-interface for wrapped ETH
 */
abstract contract IDummyToken is IERC20 {
  /**
   * @dev Deposit ETH and mint tokens.
   *
   * Amount of tokens minted will equal `msg.value`. The tokens will be added to the caller's balance.
   */
  function deposit() external virtual payable;
  /**
   * @dev Burn token and withdraw ETH.
   *
   * The withdrawn ETH will be sent to the caller.
   *
   * @param value Amount of tokens to burn.
   */
  function withdraw(uint value) external virtual;

  /**
   * @dev Emitted when ETH is deposited and tokens are minted.
   * @param sender The account.
   * @param value The amount deposited/minted.
   */
  event Deposit(address indexed sender, uint value);
  /**
   * @dev Emitted when tokens are burnt and ETH is withdrawn.
   * @param receiver The account.
   * @param value The amount withdrawn/burnt.
   */
  event Withdrawal(address indexed receiver, uint value);
}

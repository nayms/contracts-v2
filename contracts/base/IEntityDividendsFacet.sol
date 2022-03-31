// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @dev Entity dividends facet.
 */
interface IEntityDividendsFacet {
  /**
   * @dev Get no. of token holders.
   *
   * @param _unit Unit token address.
   */
  function getNumTokenHolders(address _unit) external view returns (uint256);

  /**
   * @dev Get token holder at given 1-based index.
   * 
   * @param _unit Unit token address.
   * @param _index holder at given position
   */
  function getTokenHolderAtIndex(address _unit, uint256 _index) external view returns (address);

  /**
   * @dev Pay dividends to all current token holders.
   *
   * This loops through the current list of token holders and 
   * adds to their dividend balance for the given token according 
   * to their overalll share of the entity token supply.
   *
   * @param _unit The token to pay them in.
   * @param _amount The total amount to pay out.
   */
  function payDividend(address _unit, uint256 _amount) external;

  /**
   * @dev Get withdrawable dividend.
   *
   * @param _unit The token balance to withdraw from.
   * @param _holder The holder.
   */
  function getWithdrawableDividend(address _unit, address _holder) external view returns (uint256);

  /**
   * @dev Withdraw accrued dividends of caller.
   *
   * The caller's accrued dividend balance in the given token is withdrawn and sent to them.
   *
   * @param _unit The token balance to withdraw from.
   */
  function withdrawDividend(address _unit) external;
}

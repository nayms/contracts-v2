// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IFeeBankCoreFacet {
  /**
   * @dev Get current balance of given asset.
   *
   * @param _unit The asset to check.
   */
  function getBalance(address _unit) external view returns (uint256);
}

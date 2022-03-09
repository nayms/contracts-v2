// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

/**
 * @dev The complement to `IParent`.
 */
interface IChild {
  /**
   * @dev Get the parent/creator of this contract.
   */
  function getParent() external view returns (address);
}

// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/**
 * @dev Interface for contracts that create other contracts and wish to keep track of them.
 */
interface IParent {
  /**
   * @dev Get the no. of children created.
   */
  function getNumChildren() external view returns (uint256);

  /**
   * @dev Get child at given 1-based index.
   *
   * @param _index index starting at 1. 
   *
   * @return The child contract address.
   */
  function getChild(uint256 _index) external view returns (address);

  /**
   * @dev Get whether this contract is the parent/creator of given child.
   *
   * @param _child potential child contract.
   *
   * @return true if so, false otherwise.
   */
  function isParentOf(address _child) external view returns (bool);
}

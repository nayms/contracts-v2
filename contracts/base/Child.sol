// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./IChild.sol";
import "./EternalStorage.sol";

/**
 * @dev Base class for of all child contracts created by `Parent` contracts.
 */
abstract contract Child is EternalStorage, IChild {
  function getParent() public view override returns (address) {
    return dataAddress["parent"];
  }

  /**
   * @dev Set parent contract. This can only be called once.
   *
   * @param _parent address of parent contract.
   */
  function _setParent(address _parent) internal {
    require(dataAddress["parent"] == address(0), "parent already set");
    dataAddress["parent"] = _parent;
  }
}

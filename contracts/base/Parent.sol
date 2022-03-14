// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./IParent.sol";
import "./EternalStorage.sol";

/**
 * @dev Base class for of contracts that create other contracts and wish to keep track of them.
 */
abstract contract Parent is EternalStorage, IParent {
  function getNumChildren() public view override returns (uint256) {
    return dataUint256["numChildContracts"];
  }

  function getChild(uint256 _index) public view override returns (address) {
    return dataAddress[__i(_index, "childContract")];
  }

  function hasChild(address _child) public view override returns (bool) {
    return dataBool[__a(_child, "isChildContract")];
  }

  /**
   * @dev Add a child contract to the list.
   *
   * @param _child address of child contract.
   */
  function _addChild(address _child) internal {
    dataBool[__a(_child, "isChildContract")] = true;
    dataUint256["numChildContracts"] += 1;
    dataAddress[__i(dataUint256["numChildContracts"], "childContract")] = _child;
  }
}

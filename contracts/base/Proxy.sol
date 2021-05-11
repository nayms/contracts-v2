pragma solidity 0.6.12;

import "./EternalStorage.sol";

/**
 * @dev Base class for a general proxy contract which forwards all calls to a delegate.
 */
contract Proxy is EternalStorage {
  function _setDelegateAddress(address _addr) internal {
    dataAddress["delegate"] = _addr;
  }

  fallback() external payable {
    address delegate = dataAddress["delegate"];
    require(delegate != address(0), "Delegate not set.");
    
    assembly {
      let ptr := mload(0x40)
      calldatacopy(ptr, 0, calldatasize())
      let result := delegatecall(gas(), delegate, ptr, calldatasize(), 0, 0)
      let size := returndatasize()
      returndatacopy(ptr, 0, size)
      switch result
      case 0 {revert(ptr, size)}
      default {return (ptr, size)}
    }
  }

  receive() external payable {
  }  
}



pragma solidity >=0.5.8;

import '../base/EternalStorage.sol';
import '../base/IProxyImpl.sol';
import './ITestProxyImpl.sol';

contract TestProxyImpl is EternalStorage, IProxyImpl, ITestProxyImpl {
  constructor () public {}

  // IProxyImpl //

  function getImplementationVersion () pure public returns (string memory) {
    return "test";
  }

  // ITestProxyImpl //

  function incCounter() public {
    dataUint256["data"] = dataUint256["data"] + 1;
  }

  function getCounter() public view returns (uint256) {
    return dataUint256["data"];
  }
}

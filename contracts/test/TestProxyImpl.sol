pragma solidity >=0.6.7;

import '../base/EternalStorage.sol';
import '../base/IProxyImpl.sol';
import './ITestProxyImpl.sol';

contract TestProxyImpl is EternalStorage, IProxyImpl, ITestProxyImpl {
  constructor () public {
    // nothing
  }

  // IProxyImpl //

  function getImplementationVersion () public pure override returns (string memory) {
    return "test";
  }

  // ITestProxyImpl //

  function incCounter() public override{
    dataUint256["data"] = dataUint256["data"] + 1;
  }

  function getCounter() public view override returns (uint256) {
    return dataUint256["data"];
  }
}

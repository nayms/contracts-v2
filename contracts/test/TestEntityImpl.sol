pragma solidity >=0.5.8;

import '../base/IProxyImpl.sol';

contract TestEntityImpl is IProxyImpl {
  // IProxyImpl //

  function getImplementationVersion () public pure returns (string memory) {
    return "vTest";
  }
}

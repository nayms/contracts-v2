pragma solidity >=0.6.7;

import '../base/IProxyImpl.sol';

contract TestPolicyImpl is IProxyImpl {
  // IProxyImpl //

  function getImplementationVersion () public pure override returns (string memory) {
    return "vTest";
  }
}

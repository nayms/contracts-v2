pragma solidity >=0.5.8;

import '../base/IProxyImpl.sol';

contract TestSettingsImpl is IProxyImpl {
  // IProxyImpl //

  function getImplementationVersion () public pure returns (string memory) {
    return "vTest";
  }
}

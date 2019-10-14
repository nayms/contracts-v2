pragma solidity >=0.5.8;

import '../base/Proxy.sol';

contract TestProxy is Proxy {
  constructor (address _implementation) Proxy(_implementation) public {}

  function unsafeUpgrade (address _implementation) public {
    dataAddress["implementation"] = _implementation;
  }

  function upgrade(address _implementation) public {
    setImplementation(_implementation);
  }

  function getSigner(address _implementation, bytes memory _signature) pure public returns (address) {
    return getUpgradeSigner(_implementation, _signature);
  }
}

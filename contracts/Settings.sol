pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/Proxy.sol";

contract Settings is AccessControl, Proxy {
  constructor (
    address _acl,
    address _settingsImpl
  ) AccessControl(_acl) Proxy(_settingsImpl) public {}

  function upgrade (address _implementation) public assertIsAdmin {
    setImplementation(_implementation);
  }
}

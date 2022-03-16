// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;


import "./base/Controller.sol";
import "./base/Proxy.sol";
import "./base/Child.sol";

contract Entity is Controller, Proxy, Child {
  constructor (address _settings, address _entityAdmin, bytes32 _entityContext) Controller(_settings) Proxy() {
    _setParent(msg.sender);
    _setDelegateAddress(settings().getRootAddress(SETTING_ENTITY_DELEGATE));

    if (_entityContext != "") {
      dataBytes32["aclContext"] = _entityContext;
    } else {
      acl().assignRole(aclContext(), _entityAdmin, ROLE_ENTITY_ADMIN);
    }
  }
}



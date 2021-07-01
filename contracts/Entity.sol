pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/Proxy.sol";

contract Entity is Controller, Proxy {
  constructor (address _settings, address _entityAdmin, bytes32 _entityContext) Controller(_settings) Proxy() public {
    _setDelegateAddress(settings().getRootAddress(SETTING_ENTITY_DELEGATE));

    if (_entityContext != "") {
      dataBytes32["aclContext"] = _entityContext;
    } else {
      acl().assignRole(aclContext(), _entityAdmin, ROLE_ENTITY_ADMIN);
    }
  }
}



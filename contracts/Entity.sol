pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/Proxy.sol";
import "./base/ITreasury.sol";

contract Entity is Controller, Proxy {
  constructor (address _settings, address _entityAdmin, bytes32 _entityContext) Controller(_settings) Proxy() public {
    _setDelegateAddress(settings().getRootAddress(SETTING_ENTITY_DELEGATE));

    ITreasury(settings().getRootAddress(SETTING_TREASURY)).register();

    dataUint256["treasuryCollRatioBP"] = 10000;

    if (_entityContext != "") {
      dataBytes32["aclContext"] = _entityContext;
    } else {
      acl().assignRole(aclContext(), _entityAdmin, ROLE_ENTITY_ADMIN);
    }
  }
}



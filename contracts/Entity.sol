pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";

contract Entity is Controller, DiamondProxy {
  constructor (address _settings, address _entityAdmin, bytes32 _entityContext) Controller(_settings) DiamondProxy() public {
    _registerFacets(settings().getRootAddresses(SETTING_ENTITY_IMPL));

    dataUint256["treasuryCollRatioBP"] = 10000;

    if (_entityContext != "") {
      dataBytes32["aclContext"] = _entityContext;
    } else {
      acl().assignRole(aclContext(), _entityAdmin, ROLE_ENTITY_ADMIN);
    }
  }
}



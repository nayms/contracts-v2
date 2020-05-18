pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/DiamondProxy.sol";
import "./base/ISettingsKeys.sol";

contract Entity is Controller, DiamondProxy {
  constructor (address _acl, address _settings) Controller(_acl, _settings) DiamondProxy() public {
    _registerFacets(settings().getRootAddresses(SETTING_ENTITY_IMPL));
  }

  function upgrade (address[] memory _facets) public assertIsAdmin {
    _registerFacets(_facets);
  }
}

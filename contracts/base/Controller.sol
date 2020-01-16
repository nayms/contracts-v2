pragma solidity >=0.5.8;

import "./SettingsControl.sol";
import "./AccessControl.sol";

contract Controller is AccessControl, SettingsControl {
  constructor (address _acl, address _settings)
    public
    AccessControl(_acl)
    SettingsControl(_settings)
  {
    dataAddress["settings"] = _settings;
  }
}

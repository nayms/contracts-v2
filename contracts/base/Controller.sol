pragma solidity >=0.5.8;

import "./SettingsControl.sol";
import "./AccessControl.sol";

/**
 * @dev Base contract for interacting with the ACL and Settings contracts.
 */
abstract contract Controller is AccessControl, SettingsControl {
  /**
   * @dev Constructor.
   * @param _acl ACL address.
   * @param _settings Settings address.
   */
  constructor (address _acl, address _settings)
    public
    AccessControl(_acl)
    SettingsControl(_settings)
  {
    dataAddress["settings"] = _settings;
  }
}

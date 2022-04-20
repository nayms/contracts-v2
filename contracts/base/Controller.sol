// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./SettingsControl.sol";
import "./AccessControl.sol";

/**
 * @dev Base contract for interacting with the ACL and Settings contracts.
 */
contract Controller is AccessControl, SettingsControl {
    /**
     * @dev Constructor.
     * @param _settings Settings address.
     */
    constructor(address _settings) AccessControl(_settings) SettingsControl(_settings) {}
}

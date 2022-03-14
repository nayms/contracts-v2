// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./EternalStorage.sol";
import "./ISettings.sol";
import "./ISettingsControl.sol";
import "./ISettingsKeys.sol";

/**
 * @dev Base contract for interacting with Settings.
 */
contract SettingsControl is EternalStorage, ISettingsControl, ISettingsKeys {
  /**
   * @dev Constructor.
   * @param _settings Settings address.
   */
  constructor (address _settings) {
    dataAddress["settings"] = _settings;
  }

  /**
   * @dev Get Settings reference.
   * @return Settings reference.
   */
  function settings () public view override returns (ISettings) {
    return ISettings(dataAddress["settings"]);
  }
}

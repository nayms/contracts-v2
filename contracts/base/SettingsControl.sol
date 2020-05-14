pragma solidity >=0.6.7;

import "./EternalStorage.sol";
import "./ISettings.sol";
import "./ISettingsKeys.sol";

/**
 * @dev Base contract for interacting with Settings.
 */
contract SettingsControl is EternalStorage, ISettingsKeys {
  /**
   * @dev Constructor.
   * @param _settings Settings address.
   */
  constructor (address _settings) public {
    dataAddress["settings"] = _settings;
  }

  /**
   * @dev Get Settings reference.
   * @return Settings reference.
   */
  function settings () internal view returns (ISettings) {
    return ISettings(dataAddress["settings"]);
  }
}

pragma solidity >=0.5.8;

import "./EternalStorage.sol";
import "./ISettingsImpl.sol";

/**
 * @dev Base contract for interacting with Settings.
 */
abstract contract SettingsControl is EternalStorage {
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
  function settings () internal view returns (ISettingsImpl) {
    return ISettingsImpl(dataAddress["settings"]);
  }
}

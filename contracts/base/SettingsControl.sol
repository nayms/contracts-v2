pragma solidity >=0.5.8;

import "./EternalStorage.sol";
import "./ISettingsImpl.sol";

contract SettingsControl is EternalStorage {
  constructor (address _settings) public {
    dataAddress["settings"] = _settings;
  }

  function settings () internal view returns (ISettingsImpl) {
    return ISettingsImpl(dataAddress["settings"]);
  }
}

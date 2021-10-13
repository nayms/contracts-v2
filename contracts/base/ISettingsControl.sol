// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./ISettings.sol";

interface ISettingsControl {
  /**
   * @dev Get Settings reference.
   * @return Settings reference.
   */
  function settings () external view returns (ISettings);
}

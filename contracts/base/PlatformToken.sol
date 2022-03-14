// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

/**
 * @dev Base class for all of our platform tokens.
 */
abstract contract PlatformToken {
  bool public isPlatformToken = true;

  /**
   * @dev Get whether this is a Nayms platform token.
   */
  function isNaymsPlatformToken () public view returns (bool) {
    return isPlatformToken;
  }
}

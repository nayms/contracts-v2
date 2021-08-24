pragma solidity 0.6.12;

/**
 * @dev Base class for all of our platform tokens.
 */
abstract contract PlatformToken {
  /**
   * @dev Get whether this is a Nayms platform token.
   */
  function isNaymsPlatformToken () public pure returns (bool) {
    return true;
  }
}

pragma solidity 0.6.12;

import "./PlatformToken.sol";

/**
 * @dev Nayms utils.
 */
library Utils {
    /**
     * @dev Get whether given token is a Nayms platform token.
     * @return true if so, false otherwise.
     */
    function isNaymsPlatformToken(address _token) internal view returns (bool) {
      try PlatformToken(_token).isNaymsPlatformToken() returns (bool v) {
        return v;
      } catch {
        return false;
      }
    }
}

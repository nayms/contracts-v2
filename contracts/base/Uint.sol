// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/**
 * @dev Uint utils.
 */
library Uint {
    /**
     * @dev Get string representation of given uint.
     *
     * Original: https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol#L1045
     */
    function toString(uint256 _value) internal pure returns (string memory) {
        if (_value == 0) {
            return "0";
        }
        uint256 temp = _value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (_value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_value % 10)));
            _value /= 10;
        }
        return string(buffer);
    }
}

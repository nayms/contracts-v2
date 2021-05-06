pragma solidity 0.6.12;

/**
 * @dev Uint utils.
 */
library Uint {
    /**
     * @dev Get string representation of given uint.
     *
     * Original: https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol#L1045
     */
    function toString(uint256 _i) internal pure returns (string memory) {
       if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }
}

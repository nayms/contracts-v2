pragma solidity >=0.6.7;

import "../base/EternalStorage.sol";

contract Test1Facet is EternalStorage {
    function getNumber () external view returns (uint256) {
        return dataUint256["number"];
    }

    function setNumber (uint256 base) external {
        dataUint256["number"] = base;
    }
}


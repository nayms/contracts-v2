// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./base/EternalStorage.sol";
import "./base/AccessControl.sol";

/**
 * @dev Simple Policy facet base class
 */
abstract contract SimplePolicyFacetBase is EternalStorage, AccessControl {
    function getSimplePolicyInfo()
        external
        view
        returns (
            bytes32 id_,
            uint256 number_,
            uint256 startDate_,
            uint256 maturationDate_,
            address unit_,
            uint256 limit_,
            uint256 state_,
            address treasury_
        )
    {
        id_ = dataBytes32["id"];
        number_ = dataUint256["number"];
        startDate_ = dataUint256["startDate"];
        maturationDate_ = dataUint256["maturationDate"];
        unit_ = dataAddress["unit"];
        limit_ = dataUint256["limit"];
        state_ = dataUint256["state"];
        treasury_ = dataAddress["treasury"];
    }
}

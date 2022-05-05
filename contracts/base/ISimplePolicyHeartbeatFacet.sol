// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

interface ISimplePolicyHeartbeatFacet {
    function checkAndUpdateState() external returns (bool reduceTotalLimit_);
}

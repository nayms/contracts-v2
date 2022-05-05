// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

interface ISimplePolicyApprovalsFacet {
    function approve(bytes32[] memory _roles, bytes[] memory _signatures) external;
}

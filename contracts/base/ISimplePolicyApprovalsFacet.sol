// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Simple Policy approvals methods.
 */
interface ISimplePolicyApprovalsFacet {
    /**
     * @dev Bulk-approve this policy.
     *
     * @param _roles Type of pending role the entity of the caller has.
     * @param _signatures Signatures in order: broker, underwriter, claims admin, insured party
     */
    function approveSimplePolicy(bytes32[] memory _roles, bytes[] memory _signatures) external;
}

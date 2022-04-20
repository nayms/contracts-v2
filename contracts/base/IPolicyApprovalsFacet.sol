// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Policy approvals code.
 */
interface IPolicyApprovalsFacet {
    /**
     * @dev Bulk-approve this policy.
     *
     * @param _signatures Signatures in order: broker, underwriter, claims admin, insured party
     */
    function bulkApprove(bytes[] calldata _signatures) external;

    /**
     * @dev Approve this policy.
     *
     * Caller must be a representative of given entity.
     *
     * @param _role Type of pending role the entity of the caller has.
     */
    function approve(bytes32 _role) external;

    /**
     * @dev Get approvals info.
     *
     * @return approved_ Whether the policy has been fully approved.
     * @return insuredPartyApproved_ Whether the insured party has approved the policy.
     * @return underwriterApproved_ Whether the capital provider has approved the policy.
     * @return brokerApproved_ Whether the broker has approved the policy.
     * @return claimsAdminApproved_ Whether the claims administrator has approved the policy.
     */
    function getApprovalsInfo()
        external
        view
        returns (
            bool approved_,
            bool insuredPartyApproved_,
            bool underwriterApproved_,
            bool brokerApproved_,
            bool claimsAdminApproved_
        );

    // events

    /**
     * @dev Emitted when a bulk approval occurs.
     *
     * @param caller The caller.
     */
    event BulkApproved(address indexed caller);

    /**
     * @dev Emitted when an approval occurs.
     *
     * @param approver The approver.
     * @param role The role which approved.
     */
    event Approved(address indexed approver, bytes32 indexed role);
}

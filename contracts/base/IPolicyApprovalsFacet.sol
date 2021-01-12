pragma solidity >=0.6.7;

/**
 * @dev Policy approvals code.
 */
interface IPolicyApprovalsFacet {
  /**
   * @dev Approve this policy.
   */
  function approve () external;

 /**
   * @dev Get approvals info.
   *
   * @return approved_ Whether the policy has been fully approved.
   * @return insuredPartyApproved_ Whether the insured party has approved the policy.
   * @return capitalProviderApproved_ Whether the capital provider has approved the policy.
   */
  function getApprovalsInfo () external view returns (
    bool approved_,
    bool insuredPartyApproved_,
    bool capitalProviderApproved_
  );

  // events

  /**
   * @dev Emitted when an approval occurs.
   *
   * @param caller The claim maker.
   * @param role The role which approved.
   */
  event Approved(address indexed caller, bytes32 indexed role);
}

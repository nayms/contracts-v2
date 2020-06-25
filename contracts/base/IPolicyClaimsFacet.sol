pragma solidity >=0.6.7;

/**
 * @dev Policy claims code.
 */
interface IPolicyClaimsFacet {
  /**
   * @dev Make a claim.
   *
   * @param _index Tranch index.
   * @param _clientManagerEntity Entity that will receive the payout.
   * @param _amount Amount claimed.
   */
  function makeClaim (uint256 _index, address _clientManagerEntity, uint256 _amount) external;
  /**
   * @dev Approve a claim.
   *
   * @param _claimIndex Claim index.
   */
  function approveClaim (uint256 _claimIndex) external;
  /**
   * @dev Decline a claim.
   *
   * @param _claimIndex Claim index.
   */
  function declineClaim (uint256 _claimIndex) external;
  /**
   * @dev Cancel a claim that has been approved.
   *
   * @param _claimIndex Claim index.
   */
  function cancelClaim (uint256 _claimIndex) external;
  /**
   * @dev Payout an approved claim.
   *
   * @param _claimIndex Claim index.
   */
  function payClaim(uint256 _claimIndex) external;
  /**
   * @dev Get claim stats.
   * @return numClaims_ No. of claims raised in total.
   * @return numPendingClaims_ No. of claims yet to be approved/declined.
   */
  function getClaimStats() external view returns (
    uint256 numClaims_,
    uint256 numPendingClaims_
  );
  /**
   * @dev Get claim info.
   *
   * @return amount_ Amount the claim is for.
   * @return tranchIndex_ Tranch the claim is against.
   * @return approved_ Whether the claim has been approved.
   * @return declined_ Whether the claim has been declined.
   * @return paid_ Whether the claim has been paid out.
   * @return cancelled_ Whether the claim was cancelled.
   */
  function getClaimInfo (uint256 _claimIndex) external view returns (
    uint256 amount_,
    uint256 tranchIndex_,
    bool approved_,
    bool declined_,
    bool paid_,
    bool cancelled_
  );


  // events


  /**
   * @dev Emitted when a new claim has been created.
   *
   * @param tranchIndex The tranch index.
   * @param claimIndex The claim index.
   * @param caller The claim maker.
   */
  event NewClaim(uint256 indexed tranchIndex, uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim has been approved.
   *
   * @param claimIndex The claim index.
   * @param caller The claim approver.
   */
  event ClaimApproved(uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim has been declined.
   *
   * @param claimIndex The claim index.
   * @param caller The claim decliner.
   */
  event ClaimDeclined(uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when an approved claim has been paid out.
   *
   * @param claimIndex The claim index.
   * @param caller The caller.
   */
  event ClaimPaid(uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim gets cancelled.
   *
   * @param claimIndex The claim index.
   * @param caller The caller.
   */
  event ClaimCancelled(uint256 indexed claimIndex, address indexed caller);
}

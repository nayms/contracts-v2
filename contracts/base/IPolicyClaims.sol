pragma solidity >=0.6.7;

/**
 * @dev Policy claims code.
 */
interface IPolicyClaims {
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
   * @dev Payout all approved claims.
   */
  function payClaims() external;

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
   * @dev Emitted when all approved claims have been paid out.
   *
   * @param caller The caller.
   */
  event PaidClaims(address indexed caller);
}

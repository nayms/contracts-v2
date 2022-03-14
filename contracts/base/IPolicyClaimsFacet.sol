// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

/**
 * @dev Policy claims code.
 */
abstract contract IPolicyClaimsFacet {
  /**
   * @dev State: The claim has been created/made.
   */
  uint256 constant public CLAIM_STATE_CREATED = 0;
  /**
   * @dev State: The claim has been approved.
   */
  uint256 constant public CLAIM_STATE_APPROVED = 2;
  /**
   * @dev State: The claim has been declined.
   */
  uint256 constant public CLAIM_STATE_DECLINED = 3;
  /**
   * @dev State: The claim has been paid out.
   */
  uint256 constant public CLAIM_STATE_PAID = 5;

  /**
   * @dev Make a claim.
   *
   * @param _trancheIndex Tranche index.
   * @param _amount Amount claimed.
   */
  function makeClaim (uint256 _trancheIndex, uint256 _amount) virtual external;
  /**
   * @dev Approve a claim.
   *
   * @param _claimIndex Claim index.
   */
  function approveClaim (uint256 _claimIndex) virtual external;
  /**
   * @dev Dispute a claim.
   *
   * @param _claimIndex Claim index.
   */
  function disputeClaim (uint256 _claimIndex) virtual external;
  /**
   * @dev Acknowledge a claim.
   *
   * @param _claimIndex Claim index.
   */
  function acknowledgeClaim (uint256 _claimIndex) virtual external;
  /**
   * @dev Decline a claim.
   *
   * @param _claimIndex Claim index.
   */
  function declineClaim (uint256 _claimIndex) virtual external;
  /**
   * @dev Payout an approved claim.
   *
   * @param _claimIndex Claim index.
   */
  function payClaim(uint256 _claimIndex) virtual external;
  /**
   * @dev Get claim stats.
   * @return numClaims_ No. of claims raised in total.
   * @return numPendingClaims_ No. of claims yet to be approved/declined.
   */
  function getClaimStats() virtual public view returns (
    uint256 numClaims_,
    uint256 numPendingClaims_
  );
  /**
   * @dev Get claim info.
   *
   * @return amount_ Amount the claim is for.
   * @return trancheIndex_ Tranche the claim is against.
   * @return state_ Claim state.
   */
  function getClaimInfo (uint256 _claimIndex) virtual public view returns (
    uint256 amount_,
    uint256 trancheIndex_,
    uint256 state_,
    bool disputed_,
    bool acknowledged_
  );


  // events


  /**
   * @dev Emitted when a new claim has been created.
   *
   * @param trancheIndex The tranche index.
   * @param claimIndex The claim index.
   * @param caller The claim maker.
   */
  event NewClaim(uint256 indexed trancheIndex, uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim has been disputed.
   *
   * @param claimIndex The claim index.
   * @param caller The caller.
   */
  event ClaimDisputed(uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim has been acknowledged.
   *
   * @param claimIndex The claim index.
   * @param caller The caller.
   */
  event ClaimAcknowledged(uint256 indexed claimIndex, address indexed caller);
  /**
   * @dev Emitted when a claim state has been updated.
   *
   * @param claimIndex The claim index.
   * @param newState New claim state.
   * @param caller The caller.
   */
  event ClaimStateUpdated(uint256 indexed claimIndex, uint256 indexed newState, address indexed caller);
}

pragma solidity >=0.6.7;

/**
 * @dev Policy premiums code.
 */
interface IPolicyPremiumsFacet {
  /**
   * @dev Pay the next expected premium for the given tranch.
   *
   * The caller should ensure they have approved the policy to transfer tokens on their behalf.
   *
   * @param _index Tranch index.
   */
  function payTranchPremium (uint256 _index) external;

  /**
   * @dev Get tranch premium info.
   *
   * @param _tranchIndex Tranch index.
   * @param _premiumIndex Premium index.
   * @return amount_ Amount due.
   * @return dueAt_ When it is due by (timestamp = seconds since epoch).
   * @return paidAt_ When it was paid (timestamp = seconds since epoch).
   * @return paidBy_ Who paid it.
   */
  function getTranchPremiumInfo (uint256 _tranchIndex, uint256 _premiumIndex) external view returns (
    uint256 amount_,
    uint256 dueAt_,
    uint256 paidAt_,
    address paidBy_
  );

  // events

  /**
   * @dev Emitted when a premium payment has been made.
   * @param tranchIndex The tranch token address.
   * @param amount The amount paid.
   * @param caller The payer.
   */
  event PremiumPayment (uint256 indexed tranchIndex, uint256 indexed amount, address indexed caller);
}

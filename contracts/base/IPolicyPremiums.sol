pragma solidity >=0.5.8;

/**
 * @dev Policy premiums code.
 */
interface IPolicyPremiums {
  /**
   * @dev Pay the next expected premium for the given tranch.
   *
   * The caller should ensure they have approved the policy to transfer tokens on their behalf.
   *
   * @param _index Tranch index.
   */
  function payTranchPremium (uint256 _index) external;

  // events

  /**
   * @dev Emitted when a premium payment has been made.
   * @param tranchIndex The tranch token address.
   * @param amount The amount paid.
   * @param caller The payer.
   */
  event PremiumPayment (uint256 indexed tranchIndex, uint256 indexed amount, address indexed caller);
}

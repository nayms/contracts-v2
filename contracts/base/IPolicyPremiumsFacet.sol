// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
/**
 * @dev Policy premiums code.
 */
interface IPolicyPremiumsFacet {
    /**
     * @dev Pay the next expected premium for the given tranche.
     *
     * The caller should ensure they have approved the policy to transfer tokens on their behalf.
     *
     * @param _index Tranche index.
     * @param _amount The amount to pay.
     */
    function payTranchePremium(uint256 _index, uint256 _amount) external;

    /**
     * @dev Get tranche premiums info.
     *
     * @param _trancheIndex Tranche index.
     * @return numPremiums_ No. of premium payments required in total.
     * @return nextPremiumAmount_ Payment due by the next premium interval.
     * @return nextPremiumDueAt_ When the next premium payment is due by (timestamp = seconds since epoch).
     * @return nextPremiumPaidSoFar_ Amount of next premium paid so far.
     * @return premiumPaymentsMissed_ No. of premium payments that have been missed.
     * @return numPremiumsPaid_ No. of premium payments made.
     */
    function getTranchePremiumsInfo(uint256 _trancheIndex)
        external
        view
        returns (
            uint256 numPremiums_,
            uint256 nextPremiumAmount_,
            uint256 nextPremiumDueAt_,
            uint256 nextPremiumPaidSoFar_,
            uint256 premiumPaymentsMissed_,
            uint256 numPremiumsPaid_
        );

    /**
     * @dev Get tranche specific premium info.
     *
     * @param _trancheIndex Tranche index.
     * @param _premiumIndex Premium index.
     * @return amount_ Amount due.
     * @return dueAt_ When it is due by (timestamp = seconds since epoch).
     * @return paidSoFar_ How much has been paid so far.
     * @return fullyPaidAt_ When it was fully paid (timestamp = seconds since epoch).
     */
    function getTranchePremiumInfo(uint256 _trancheIndex, uint256 _premiumIndex)
        external
        view
        returns (
            uint256 amount_,
            uint256 dueAt_,
            uint256 paidSoFar_,
            uint256 fullyPaidAt_
        );

    // events

    /**
     * @dev Emitted when a premium payment has been made.
     * @param trancheIndex The tranche token address.
     * @param amount The amount paid.
     * @param caller The payer.
     */
    event PremiumPayment(uint256 indexed trancheIndex, uint256 indexed amount, address indexed caller);
}

pragma solidity >=0.5.8;

import "./IPolicyMutations.sol";

/**
 * @dev Policies.
 */
contract IPolicyImpl is IPolicyMutations {
  /**
   * @dev Create tranch.
   *
   * @param _numShares No. of shares in this tranch.
   * @param _pricePerShareAmount Price of each share during the initial sale period.
   * @param _premiums Premium payment amounts in chronological order.
   * @param _initialBalanceHolder For testing only. For normal use set to `0x`.
   */
  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] memory _premiums,
    address _initialBalanceHolder
  ) public;

  /**
   * @dev Get policy info.
   *
   * @return initiationDate_ Initiation date (when initial should begin).
   * @return startDate_ Start date (once initial sale is complete).
   * @return maturationDate_ Maturation date.
   * @return unit_ Payment unit (for tranch sale, premiums, claim payouts, etc).
   * @return premiumIntervalSeconds_ Time between premium payments (seconds).
   * @return brokerCommissionBP_ Broker's commission rate (1 = 0.1%)
   * @return assetManagerCommissionBP_ Asset managers commission rate (1 = 0.1%)
   * @return naymsCommissionBP_ Nayms commission rate (1 = 0.1%)
   * @return numTranches_ No. of tranches created.
   * @return state_ Current policy state.
   */
  function getInfo () public view returns (
    uint256 initiationDate_,
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 premiumIntervalSeconds_,
    uint256 brokerCommissionBP_,
    uint256 assetManagerCommissionBP_,
    uint256 naymsCommissionBP_,
    uint256 numTranches_,
    uint256 state_
  );

  /**
   * @dev Get claim stats.
   * @return numClaims_ No. of claims raised in total.
   * @return numPendingClaims_ No. of claims yet to be approved/declined.
   */
  function getClaimStats() public view returns (
    uint256 numClaims_,
    uint256 numPendingClaims_
  );

  /**
   * @dev Get tranch info.
   *
   * @param _index Tranch index.
   * @return token_ Tranch ERC-20 token address.
   * @return state_ Current tranch state.
   * @return balance_ Current tranch balance (of the payment unit)
   * @return nextPremiumAmount_ Payment due by the next premium interval.
   * @return premiumPaymentsMissed_ No. of previous premium payments that have been missed.
   * @return allPremiumsPaid_ Whether all expected premiums have been paid so far.
   * @return sharesSold_ No. of shared sold (during the initial sale period).
   * @return initialSaleOfferId_ Market offer id of the initial sale.
   * @return finalBuybackofferId_ Market offer id of the post-maturation/cancellation token buyback.
   */
  function getTranchInfo (uint256 _index) public view returns (
    address token_,
    uint256 state_,
    uint256 balance_,
    uint256 nextPremiumAmount_,
    uint256 premiumPaymentsMissed_,
    bool allPremiumsPaid_,
    uint256 sharesSold_,
    uint256 initialSaleOfferId_,
    uint256 finalBuybackofferId_
  );

  /**
   * @dev Get accumulated commission balances.
   *
   * Note that these balances do not include amounts that have already been paid out (see `payCommissions()`).
   *
   * @return brokerCommissionBalance_ Currently accumulated broker commission.
   * @return assetManagerCommissionBalance_ Currently accumulated asset manager commission.
   * @return naymsCommissionBalance_ Currently accumulated Nayms commission.
   */
  function getCommissionBalances() public view returns (
    uint256 brokerCommissionBalance_,
    uint256 assetManagerCommissionBalance_,
    uint256 naymsCommissionBalance_
  );

  /**
   * @dev Pay the next expected premium for the given tranch.
   *
   * The caller should ensure they have approved the policy to transfer tokens on their behalf.
   *
   * @param _index Tranch index.
   */
  function payTranchPremium (uint256 _index) public;

  /**
   * @dev Get claim info.
   *
   * @return amount_ Amount the claim is for.
   * @return tranchIndex_ Tranch the claim is against.
   * @return approved_ Whether the claim has been approved.
   * @return declined_ Whether the claim has been declined.
   * @return paid_ Whether the claim has been paid out.
   */
  function getClaimInfo (uint256 _claimIndex) public view returns (
    uint256 amount_,
    uint256 tranchIndex_,
    bool approved_,
    bool declined_,
    bool paid_
  );

  /**
   * @dev Get the max. no. of premium payments possible based on the policy dates.
   *
   * @return Max. no. of premium payments possible.
   */
  function calculateMaxNumOfPremiums() public view returns (uint256);
  /**
   * @dev Get whether the initiation date has passed.
   *
   * @return true if so, false otherwise.
   */
  function initiationDateHasPassed () public view returns (bool);
  /**
   * @dev Get whether the start date has passed.
   *
   * @return true if so, false otherwise.
   */
  function startDateHasPassed () public view returns (bool);
  /**
   * @dev Get whether the maturation date has passed.
   *
   * @return true if so, false otherwise.
   */
  function maturationDateHasPassed () public view returns (bool);

  /**
   * @dev Heartbeat: Ensure the policy and tranch states are up-to-date.
   */
  function checkAndUpdateState () public;

  // events

  /**
   * @dev Emitted when a new tranch has been created.
   * @param token The tranch token address.
   * @param initialBalanceHolder For testing purpses. Ignore.
   * @param index The tranch index.
   */
  event CreateTranch(
    address indexed token,
    address indexed initialBalanceHolder,
    uint256 index
  );

  /**
   * @dev Emitted when a premium payment has been made.
   * @param tranchIndex The tranch token address.
   * @param amount The amount paid.
   * @param caller The payer.
   */
  event PremiumPayment (uint256 indexed tranchIndex, uint256 indexed amount, address indexed caller);
}

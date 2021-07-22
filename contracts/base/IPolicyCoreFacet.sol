pragma solidity 0.6.12;


/**
 * @dev Policy core logic.
 */
interface IPolicyCoreFacet {
  /**
   * @dev Create tranch.
   *
   * @param _numShares No. of shares in this tranch.
   * @param _pricePerShareAmount Price of each share during the initial sale period.
   * @param _premiums Premium payment amounts in chronological order.
   */
  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] calldata _premiums
  ) external;

  /**
   * @dev Mark policy as ready for approval.
   */
  function markAsReadyForApproval () external;

  /**
   * @dev Get policy info.
   *
   * @return treasury_ The Entity which acts as this policy's treasury.
   * @return initiationDate_ Initiation date  (seconds since epoch).
   * @return startDate_ Start date  (seconds since epoch).
   * @return maturationDate_ Maturation date (seconds since epoch).
   * @return unit_ Payment unit (for tranch sale, premiums, claim payouts, etc).
   * @return premiumIntervalSeconds_ Time between premium payments (seconds).
   * @return brokerCommissionBP_ Broker's commission rate (1 = 0.1%)
   * @return underwriterCommissionBP_ Broker's commission rate (1 = 0.1%)
   * @return claimsAdminCommissionBP_ Claims admin commission rate (1 = 0.1%)
   * @return naymsCommissionBP_ Nayms commission rate (1 = 0.1%)
   * @return numTranches_ No. of tranches created.
   * @return state_ Current policy state.
   */
  function getInfo () external view returns (
    address treasury_,
    uint256 initiationDate_,
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 premiumIntervalSeconds_,
    uint256 brokerCommissionBP_,
    uint256 underwriterCommissionBP_,
    uint256 claimsAdminCommissionBP_,
    uint256 naymsCommissionBP_,
    uint256 numTranches_,
    uint256 state_
  );

  /**
   * @dev Get tranch info.
   *
   * @param _index Tranch index.
   * @return token_ Tranch ERC-20 token address.
   * @return state_ Current tranch state.
   * @return numShares_ No. of shares.
   * @return initialPricePerShare_ Initial price per share.
   * @return balance_ Current tranch balance (of the payment unit)
   * @return sharesSold_ No. of shared sold (during the initial sale period).
   * @return initialSaleOfferId_ Market offer id of the initial sale.
   * @return finalBuybackofferId_ Market offer id of the post-maturation/cancellation token buyback.
   * @return buybackCompleted_ True once token buyback has completed.
   */
  function getTranchInfo (uint256 _index) external view returns (
    address token_,
    uint256 state_,
    uint256 numShares_,
    uint256 initialPricePerShare_,
    uint256 balance_,
    uint256 sharesSold_,
    uint256 initialSaleOfferId_,
    uint256 finalBuybackofferId_,
    bool buybackCompleted_
  );



  /**
   * @dev Get the max. no. of premium payments possible based on the policy dates.
   *
   * @return Max. no. of premium payments possible.
   */
  function calculateMaxNumOfPremiums() external view returns (uint256);
  /**
   * @dev Get whether the initiation date has passed.
   *
   * @return true if so, false otherwise.
   */
  function initiationDateHasPassed () external view returns (bool);
  /**
   * @dev Get whether the start date has passed.
   *
   * @return true if so, false otherwise.
   */
  function startDateHasPassed () external view returns (bool);
  /**
   * @dev Get whether the maturation date has passed.
   *
   * @return true if so, false otherwise.
   */
  function maturationDateHasPassed () external view returns (bool);

  /**
   * @dev Heartbeat: Ensure the policy and tranch states are up-to-date.
   */
  function checkAndUpdateState () external;

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
}

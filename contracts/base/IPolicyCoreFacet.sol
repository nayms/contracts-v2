// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;


/**
 * @dev Policy core logic.
 */
interface IPolicyCoreFacet {
  /**
   * @dev Create tranche.
   *
   * @param _numShares No. of shares in this tranche.
   * @param _pricePerShareAmount Price of each share during the initial sale period.
   * @param _premiums Premium payment amounts in chronological order.
   */
  function createTranche (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] calldata _premiums
  ) external;

  /**
   * @dev Get policy info.
   *
   * @return id_ The policy id.
   * @return treasury_ The Entity which acts as this policy's treasury.
   * @return initiationDate_ Initiation date  (seconds since epoch).
   * @return startDate_ Start date  (seconds since epoch).
   * @return maturationDate_ Maturation date (seconds since epoch).
   * @return unit_ Payment unit (for tranche sale, premiums, claim payouts, etc).
   * @return numTranches_ No. of tranches created.
   * @return state_ Current policy state.
   * @return type_ Policy type.
   */
  //  * @return premiumIntervalSeconds_ Time between premium payments (seconds).
  function getInfo () external view returns (
    bytes32 id_,
    address treasury_,
    uint256 initiationDate_,
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    // uint256 premiumIntervalSeconds_,
    uint256 numTranches_,
    uint256 state_,
    uint256 type_
  );

  /**
   * @dev Get tranche info.
   *
   * @param _index Tranche index.
   * @return token_ Tranche ERC-20 token address.
   * @return state_ Current tranche state.
   * @return numShares_ No. of shares.
   * @return initialPricePerShare_ Initial price per share.
   * @return balance_ Current tranche balance (of the payment unit)
   * @return sharesSold_ No. of shared sold (during the initial sale period).
   * @return initialSaleOfferId_ Market offer id of the initial sale.
   * @return finalBuybackofferId_ Market offer id of the post-maturation/cancellation token buyback.
   * @return buybackCompleted_ True once token buyback has completed.
   */
  function getTrancheInfo (uint256 _index) external view returns (
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



  // /**
  //  * @dev Get the max. no. of premium payments possible based on the policy dates.
  //  *
  //  * @return Max. no. of premium payments possible.
  //  */
  // function calculateMaxNumOfPremiums() external view returns (uint256);

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
   * @dev Heartbeat: Ensure the policy and tranche states are up-to-date.
   */
  function checkAndUpdateState () external;

  // events

  /**
   * @dev Emitted when a new tranche has been created.
   * @param index The tranche index.
   */
  event CreateTranche(
    uint256 index
  );
}

pragma solidity >=0.5.8;

import "./IPolicyMutations.sol";

contract IPolicyImpl is IPolicyMutations {

  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] memory _premiums,
    address _initialBalanceHolder
  ) public returns (uint256);

  function getInfo () public view returns (
    uint256 initiationDate_,
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 premiumIntervalSeconds_,
    uint256 brokerCommissionRate_,
    uint256 assetManagerCommissionRate_,
    uint256 naymsCommissionRate_,
    uint256 numTranches_,
    uint256 state_,
    uint256 numClaims_,
    uint256 numPendingClaims_
  );

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

  function getCommissionBalances() public view returns (
    uint256 assetManagerCommissionBalance_,
    uint256 naymsCommissionBalance_,
    uint256 brokerCommissionBalance_
  );

  function payTranchPremium (uint256 _index) public;

  function getClaimInfo (uint256 _claimIndex) public view returns (
    uint256 amount_,
    uint256 tranchIndex_,
    bool approved_,
    bool declined_,
    bool paid_
  );

  function calculateMaxNumOfPremiums() public view returns (uint256);
  function initiationDateHasPassed () public view returns (bool);
  function startDateHasPassed () public view returns (bool);
  function maturationDateHasPassed () public view returns (bool);

  function checkAndUpdateState () public;

  // events

  event CreateTranch(
    address indexed policy,
    address indexed tranch,
    address indexed initialBalanceHolder,
    uint256 index
  );

  event BeginSale(address indexed policy, address indexed caller);
  event PolicyActive(address indexed policy, address indexed caller);
}

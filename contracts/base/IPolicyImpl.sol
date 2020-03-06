pragma solidity >=0.5.8;

import "./IPolicyMutations.sol";

contract IPolicyImpl is IPolicyMutations {
  function getStartDate () public view returns (uint256);
  function getState () public view returns (uint256);

  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] memory _premiums,
    address _initialBalanceHolder
  ) public returns (uint256);

  function getNumTranches () public view returns (uint256);

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

  function payTranchPremium (uint256 _index) public;

  function getAssetManagerCommissionBalance () public view returns (uint256);
  function getNaymsCommissionBalance () public view returns (uint256);
  function getBrokerCommissionBalance () public view returns (uint256);

  function getNumberOfClaims () public view returns (uint256);
  function getNumberOfPendingClaims () public view returns (uint256);

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

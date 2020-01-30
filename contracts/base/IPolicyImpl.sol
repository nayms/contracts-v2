pragma solidity >=0.5.8;

contract IPolicyImpl {
  uint256 constant public STATE_DRAFT = 0;
  uint256 constant public STATE_PENDING = 1;
  uint256 constant public STATE_ACTIVE = 2;
  uint256 constant public STATE_CANCELLED = 3;
  uint256 constant public STATE_MATURED = 4;

  function getStartDate () public view returns (uint256);
  function getState () public view returns (uint256);

  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256[] memory _premiums,
    address _initialBalanceHolder
  ) public returns (uint256);
  function getNumTranches () public view returns (uint256);
  function getTranchToken (uint256 _index) public view returns (address);
  function getTranchState (uint256 _index) public view returns (uint256);
  function tranchPremiumsAreUptoDate (uint256 _index) public view returns (bool);
  function tranchPaymentsAllMade (uint256 _index) public view returns (bool);
  function getNextTranchPremiumAmount (uint256 _index) public view returns (uint256);
  function payTranchPremium (uint256 _index) public;

  function beginSale () public;
  function endSale () public;

  function initiationDateHasPassed () public view returns (bool);
  function startDateHasPassed () public view returns (bool);

  // events

  event CreateTranch(
    address indexed policy,
    address indexed tranch,
    address indexed initialBalanceHolder,
    uint256 index
  );

  event BeginSale(address indexed caller);
  event PolicyActive(address indexed caller);
  event PolicyCancelled(address indexed caller);
}

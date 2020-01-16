pragma solidity >=0.5.8;

contract IPolicyImpl {
  // basic details

  function getName () external view returns (string memory);
  function setName (string calldata _name) external;

  // tranches

  uint256 public constant STATE_VOID = 0;
  uint256 public constant STATE_CREATED = 1;
  uint256 public constant STATE_SELLING = 2;
  uint256 public constant STATE_SOLD = 3;
  uint256 public constant STATE_LIVE = 4;
  uint256 public constant STATE_EXPIRED = 5;

  function createTranch (
    uint256 _numShares,
    uint256 _pricePerShareAmount,
    uint256 _premiumAmount,
    uint256 _premiumIntervalSeconds,
    address _denominationUnit,
    uint256 _startDateSeconds,
    address _initialBalanceHolder
  ) external returns (uint256);
  function getNumTranches () external view returns (uint256);
  function getTranchToken (uint256 _index) external view returns (address);
  function getTranchStatus (uint256 _index) external view returns (uint256);
  function beginTranchSale (uint256 _index) external;

  // events

  event CreateTranch(
    address indexed policy,
    address indexed tranch,
    address indexed initialBalanceHolder,
    uint256 index
  );

  event BeginTranchSale(
    uint256 indexed tranch,
    uint256 indexed amount,
    uint256 indexed price,
    address unit
  );
}

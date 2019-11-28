pragma solidity >=0.5.8;

interface IPolicyImpl {
  // basic details

  function getName () external view returns (string memory);
  function setName (string calldata _name) external;

  // tranches

  function createTranch (
    uint256 _numShares,
    uint256 _initialPricePerShare,
    address _initialPricePerShareUnit,
    address _initialBalanceHolder
  ) external returns (uint256);
  function getNumTranches () external view returns (uint256);
  function getTranch (uint256 _index) external view returns (address);
  function beginTranchSale(uint256 _index, address _market) external;

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

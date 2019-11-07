pragma solidity >=0.5.8;

interface IFUCImpl {
  // basic details

  function getName () external view returns (string memory);
  function setName (string calldata _name) external;

  // tranches

  function createTranch (uint256 _numShares, uint256 _initialPricePerShare, address _initialPricePerShareUnit) external;
  function getNumTranches () external view returns (uint256);
  function getTranch (uint256 _index) external view returns (address);
  function beginTranchSale(uint256 _index, address _market) external;

  // events

  event CreateTranch(
    address indexed fuc,
    address indexed tranch,
    uint256 index
  );

  event BeginTranchSale(
    uint256 indexed tranch,
    address market,
    address priceUnit,
    uint256 totalPrice
  );
}

pragma solidity >=0.5.8;

interface IFUCImpl {
  // basic details

  function getName () external view returns (string memory);
  function setName (string calldata _name) external;

  // tranches

  function createTranches (uint256[] calldata _tranchNumShares, uint256[] calldata _tranchInitialPricePerShare) external;
  function getNumTranches () external view returns (uint256);
  function getTranch (uint256 _index) external view returns (address);

  // events

  event CreateTranch(
    address indexed fuc,
    address indexed tranch,
    uint256 index
  );
}

pragma solidity >=0.5.8;

interface IEntityImpl {
  // basic details

  function getName () external view returns (string memory);
  function setName (string calldata _name) external;
}

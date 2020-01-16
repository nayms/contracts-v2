pragma solidity >=0.5.8;

interface IProxyImpl {
  function getImplementationVersion() external pure returns (string memory);
}

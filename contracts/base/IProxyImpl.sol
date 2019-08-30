pragma solidity >=0.5.8;

interface IProxyImpl {
  function getImplementationVersion() pure external returns (string memory);
}

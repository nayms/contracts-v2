pragma solidity >=0.6.7;

interface ITestProxyImpl {
  function incCounter() external;
  function getCounter() external view returns (uint256);
}

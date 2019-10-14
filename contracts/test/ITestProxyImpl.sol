pragma solidity >=0.5.8;

interface ITestProxyImpl {
  function incCounter() external;
  function getCounter() external view returns (uint256);
}

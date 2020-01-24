pragma solidity >=0.5.8;

interface ISettingsImpl {
  function setMatchingMarket(address _market) external;
  function getMatchingMarket() external view returns (address);
  function getTime() external view returns (uint256);
}

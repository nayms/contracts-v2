pragma solidity >=0.5.8;

interface IEntityImpl {
  /**
   * Notify that a new Policy has been deployed.
   */
  event NewPolicy(
    address indexed policy,
    address indexed entity,
    address indexed deployer
  );

  function createPolicy(
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256 _brokerCommissionBP,
    uint256 _assetManagerCommissionBP,
    uint256 _naymsCommissionBP
  ) external;
  function getNumPolicies() external view returns (uint256);
  function getPolicy(uint256 _index) external view returns (address);

  function deposit(address _unit, uint256 _amount) external;
  function withdraw(address _unit, uint256 _amount) external;

  function trade(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount) external;
  function sellAtBestPrice(address _sellUnit, uint256 _sellAmount, address _buyUnit) external;
}

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
    address _impl,
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256 _brokerCommission,
    uint256 _assetManagerCommission,
    uint256 _naymsCommission
  ) external;
  function getNumPolicies() external view returns (uint256);
  function getPolicy(uint256 _index) external view returns (address);

  function deposit(address _unit, uint256 _amount) external;
  function withdraw(address _unit, uint256 _amount) external;

  function buyTokens(address _buyUnit, uint256 _buyAmount, address _payUnit, uint256 _payAmount) external;
}

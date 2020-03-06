pragma solidity >=0.5.8;

interface ISettingsImpl {
  function setMatchingMarket(address _market) external;
  function getMatchingMarket() external view returns (address);

  function setEntityDeployer(address _entityDeployer) external;
  function getEntityDeployer() external view returns (address);

  function setPolicyImplementation(address _policyImplementation) external;
  function getPolicyImplementation() external view returns (address);

  function setPolicyMutations(address _policyMutations) external;
  function getPolicyMutations() external view returns (address);

  function setNaymsEntity(address _naymsEntity) external;
  function getNaymsEntity() external view returns (address);

  function getTime() external view returns (uint256);
}

pragma solidity >=0.5.8;

interface IEntityDeployer {
  function deploy() external;
  function getNumEntities() external view returns (uint256);
  function getEntity(uint256 _index) external view returns (address);

  /**
   * Notify that a new Policy has been deployed.
   */
  event NewEntity(
    address indexed entity,
    address indexed deployer
  );
}

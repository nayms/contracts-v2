pragma solidity >=0.5.8;

interface IEntityDeployer {
  /**
   * @dev Deploy a new entity.
   */
  function deploy() external;
  /**
   * @dev Get the no. of entities deployed.
   * @return The no. of entities deployed.
   */
  function getNumEntities() external view returns (uint256);
  /**
   * @dev Get entity.
   * @return The entity address.
   */
  function getEntity(uint256 _index) external view returns (address);

  /**
   * @dev Emitted when a new entity has been created.
   * @param entity The entity address.
   * @param deployer The person who deployed it.
   */
  event NewEntity(
    address indexed entity,
    address indexed deployer
  );
}

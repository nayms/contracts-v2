pragma solidity >=0.5.8;

/**
 * @dev Settings.
 */
interface ISettingsImpl {
  /**
   * @dev Set matching market.
   *
   * @param _market The address.
   */
  function setMatchingMarket(address _market) external;
  /**
   * @dev Get the matching market.
   *
   * @return The address.
   */
  function getMatchingMarket() external view returns (address);

  /**
   * @dev Set entity deployer.
   *
   * @param _entityDeployer The address.
   */
  function setEntityDeployer(address _entityDeployer) external;
  /**
   * @dev Get the entity deployer.
   *
   * @return The address.
   */
  function getEntityDeployer() external view returns (address);

  /**
   * @dev Set policy implementation.
   *
   * @param _policyImplementation The address.
   */
  function setPolicyImplementation(address _policyImplementation) external;
  /**
   * @dev Get the policy implementation.
   *
   * @return The address.
   */
  function getPolicyImplementation() external view returns (address);

  /**
   * @dev Set policy mutations.
   *
   * @param _policyMutations The address.
   */
  function setPolicyMutations(address _policyMutations) external;
  /**
   * @dev Get the policy mutations.
   *
   * @return The address.
   */
  function getPolicyMutations() external view returns (address);

  /**
   * @dev Set Nayms entity.
   *
   * @param _naymsEntity The address.
   */
  function setNaymsEntity(address _naymsEntity) external;
  /**
   * @dev Get the Nayms entity.
   *
   * @return The address.
   */
  function getNaymsEntity() external view returns (address);

  /**
   * @dev Get current block time.
   *
   * @return Block time.
   */
  function getTime() external view returns (uint256);
}

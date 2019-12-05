pragma solidity >=0.5.8;

interface IEntityDeployer {
  function deploy(string calldata _name) external;

  /**
   * Notify that a new Policy has been deployed.
   */
  event NewEntity(
    address indexed deployedAddress,
    address indexed deployer
  );
}

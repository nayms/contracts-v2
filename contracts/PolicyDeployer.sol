pragma solidity ^0.5.4;

import './base/EternalStorage.sol';
import './base/Destructible.sol';
import './Policy.sol';

/**
 * This is responsible for deploying a new Policy.
 */
contract PolicyDeployer is EternalStorage, Destructible {
  /**
   * Notify that a new Policy has been deployed.
   */
  event NewPolicy(
    address indexed deployedAddress,
    address indexed deployer
  );

  /**
   * Constructor
   */
  constructor (
    address _acl,
    address _policyImpl
  ) Destructible(_acl, "policyDeployer") public {
    dataAddress["implementation"] = _policyImpl;
  }

  /**
   * Deploy a new Policy.
   */
  function deploy(
    string calldata _aclContext,
    string calldata _name
  ) external {
    Policy f = new Policy(
      address(acl()),
      _aclContext,
      dataAddress["implementation"],
      _name
    );

    emit NewPolicy(address(f), msg.sender);
  }
}

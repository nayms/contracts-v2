pragma solidity ^0.5.4;

import './base/EternalStorage.sol';
import './base/Destructible.sol';
import './FUC.sol';

/**
 * This is responsible for deploying a new FUC.
 */
contract FUCDeployer is EternalStorage, Destructible {
  /**
   * Notify that a new FUC has been deployed.
   */
  event NewFUC(
    address indexed deployedAddress,
    address indexed deployer
  );

  /**
   * Constructor
   */
  constructor (
    address _acl,
    address _fucImpl
  ) Destructible(_acl, "fucDeployer") public {
    dataAddress["fucImplementation"] = _fucImpl;
  }

  /**
   * Deploy a new FUC.
   */
  function deploy(
    string calldata _aclContext,
    string calldata _name
  ) external {
    FUC f = new FUC(
      address(acl()),
      _aclContext,
      dataAddress["fucImplementation"],
      _name
    );

    emit NewFUC(address(f), msg.sender);
  }
}

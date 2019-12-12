pragma solidity ^0.5.4;

import './base/AccessControl.sol';
import './base/EternalStorage.sol';
import './base/Destructible.sol';
import './base/IEntityDeployer.sol';
import './Entity.sol';

/**
 * This is responsible for deploying a new Entity.
 */
contract EntityDeployer is EternalStorage, AccessControl, Destructible, IEntityDeployer {
  /**
   * Constructor
   */
  constructor (address _acl, address _entityImpl) Destructible(_acl) public {
    dataAddress["implementation"] = _entityImpl;
  }

  /**
   * @dev Deploy a new Entity.
   */
  function deploy(string memory _name) public assertIsAdmin {
    Entity f = new Entity(
      address(acl()),
      dataAddress["implementation"],
      _name
    );

    emit NewEntity(address(f), msg.sender);
  }
}

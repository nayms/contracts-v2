pragma solidity ^0.5.4;

import './base/EternalStorage.sol';
import './base/Destructible.sol';
import './base/IEntityDeployer.sol';
import './Entity.sol';

/**
 * This is responsible for deploying a new Entity.
 */
contract EntityDeployer is EternalStorage, Destructible, IEntityDeployer {
  modifier assertCanCreateEntity () {
    require(isAdmin(msg.sender) || inRoleGroup(msg.sender, ROLEGROUP_SYSTEM_MANAGERS), 'must be system manager');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _acl, address _settings, address _entityImpl) Destructible(_acl, _settings) public {
    dataAddress["implementation"] = _entityImpl;
  }

  /**
   * @dev Deploy a new Entity.
   */
  function deploy() public assertCanCreateEntity {
    Entity f = new Entity(
      address(acl()),
      address(settings()),
      dataAddress["implementation"]
    );

    uint256 numEntities = dataUint256["numEntities"];
    dataAddress[__i(numEntities, "entity")] = address(f);
    dataUint256["numEntities"] = numEntities + 1;

    emit NewEntity(address(f), msg.sender);
  }


  function getNumEntities() public view returns (uint256) {
    return dataUint256["numEntities"];
  }


  function getEntity(uint256 _index) public view returns (address) {
    return dataAddress[__i(_index, "entity")];
  }
}

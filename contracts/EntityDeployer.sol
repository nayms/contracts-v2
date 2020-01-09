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

    uint256 numEntities = dataUint256["numEntities"];
    dataAddress[string(abi.encodePacked("entity", numEntities))] = address(f);
    dataUint256["numEntities"] = numEntities + 1;

    emit NewEntity(address(f), msg.sender);
  }


  function getNumEntities() public view returns (uint256) {
    return dataUint256["numEntities"];
  }


  function getEntity(uint256 _index) public view returns (address) {
    return dataAddress[string(abi.encodePacked("entity", _index))];
  }
}

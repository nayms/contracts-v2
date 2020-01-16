pragma solidity ^0.5.4;

import './base/EternalStorage.sol';
import './base/Destructible.sol';
import './base/IEntityDeployer.sol';
import './Entity.sol';

/**
 * This is responsible for deploying a new Entity.
 */
contract EntityDeployer is EternalStorage, Destructible, IEntityDeployer {
  /**
   * Constructor
   */
  constructor (address _acl, address _settings, address _entityImpl) Destructible(_acl, _settings) public {
    dataAddress["implementation"] = _entityImpl;
  }

  /**
   * @dev Deploy a new Entity.
   */
  function deploy(string memory _name) public assertIsAdmin {
    Entity f = new Entity(
      address(acl()),
      address(settings()),
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

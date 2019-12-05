pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityImpl.sol";

/**
 * @dev Business-logic for Entity
 */
contract EntityImpl is EternalStorage, AccessControl, IEntityImpl {

  /**
   * Constructor
   */
  constructor (address _acl, string memory _aclContext)
    AccessControl(_acl, _aclContext)
    public
  {}

  // IEntityImpl - basic details

  function setName (string memory _name)
    public
    assertInRoleGroup(ROLEGROUP_MANAGE_ENTITY)
  {
    dataString["name"] = _name;
  }

  function getName ()
    public
    view
    returns (string memory)
  {
    return dataString["name"];
  }
}

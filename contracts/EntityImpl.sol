pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityImpl.sol";
import "./Policy.sol";

/**
 * @dev Business-logic for Entity
 */
contract EntityImpl is EternalStorage, AccessControl, IEntityImpl {

  /**
   * Constructor
   */
  constructor (address _acl)
    AccessControl(_acl)
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

  // IEntityImpl - policies

  function createPolicy(address _impl, string memory _name)
    public
    assertInRoleGroup(ROLEGROUP_MANAGE_POLICY)
  {
    Policy f = new Policy(
      address(acl()),
      aclContext(),
      _impl,
      _name
    );

    emit NewPolicy(address(f), msg.sender);
  }
}

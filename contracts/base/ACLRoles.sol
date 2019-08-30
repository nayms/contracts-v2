pragma solidity >=0.5.8;


/**
 * @title ACLRoles
 * @dev Library for managing addresses assigned to a Role within a context.
 */
library ACLRoles {
  struct Role {
    mapping (address => bool) bearer;
  }

  struct Context {
    mapping (bytes32 => Role) roles;
  }

  /**
   * @dev give an address access to this role
   */
  function add(Context storage _context, bytes32 _role, address _addr)
    internal
  {
    _context.roles[_role].bearer[_addr] = true;
  }

  /**
   * @dev remove an address' access to this role
   */
  function remove(Context storage _context, bytes32 _role, address _addr)
    internal
  {
    _context.roles[_role].bearer[_addr] = false;
  }

  /**
   * @dev check if an address has this role
   * @return bool
   */
  function has(Context storage _context, bytes32 _role, address _addr)
    view
    internal
    returns (bool)
  {
    return _context.roles[_role].bearer[_addr];
  }
}

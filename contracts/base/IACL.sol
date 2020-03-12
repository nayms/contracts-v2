pragma solidity >=0.5.8;

/**
 * @dev ACL (Access Control List) interface.
 */
interface IACL {
  // admin

  /**
   * @dev Check if given address has the admin role.
   * @param _addr Address to check.
   * @return true if so
   */
  function isAdmin(address _addr) external view returns (bool);
  /**
   * @dev Assign admin role to given address.
   * @param _addr Address to assign to.
   */
  function addAdmin(address _addr) external;
  /**
   * @dev Remove admin role from given address.
   * @param _addr Address to remove from.
   */
  function removeAdmin(address _addr) external;

  // contexts

  /**
   * @dev Get the no. of existing contexts.
   * @return no. of contexts
   */
  function getNumContexts() external view returns (uint256);
  /**
   * @dev Get context at given index.
   * @param _index Index into list of all contexts.
   * @return context name
   */
  function getContextAtIndex(uint256 _index) external view returns (bytes32);
  /**
   * @dev Get the no. of addresses belonging to (i.e. who have been assigned roles in) the given context.
   * @param _context Name of context.
   * @return no. of addresses
   */
  function getNumUsersInContext(bytes32 _context) external view returns (uint256);
  /**
   * @dev Get the address at the given index in the list of addresses belonging to the given context.
   * @param _context Name of context.
   * @param _index Index into the list of addresses
   * @return the address
   */
  function getUserInContextAtIndex(bytes32 _context, uint _index) external view returns (address);

  // users

  /**
   * @dev Get the no. of contexts the given address belongs to (i.e. has an assigned role in).
   * @param _addr Address.
   * @return no. of contexts
   */
  function getNumContextsForUser(address _addr) external view returns (uint256);
  /**
   * @dev Get the contexts at the given index in the list of contexts the address belongs to.
   * @param _addr Address.
   * @param _index Index of context.
   * @return Context name
   */
  function getContextForUserAtIndex(address _addr, uint256 _index) external view returns (bytes32);
  /**
   * @dev Get whether given address has a role assigned in the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @return true if so
   */
  function userSomeHasRoleInContext(bytes32 _context, address _addr) external view returns (bool);

  // role groups

  /**
   * @dev Get whether given address has a role in the given rolegroup in the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @param _roleGroup The role group.
   * @return true if so
   */
  function hasRoleInGroup(bytes32 _context, address _addr, bytes32 _roleGroup) external view returns (bool);
  /**
   * @dev Set the roles for the given role group.
   * @param _roleGroup The role group.
   * @param _roles List of roles.
   */
  function setRoleGroup(bytes32 _roleGroup, bytes32[] calldata _roles) external;
  /**
   * @dev Get whether given given name represents a role group.
   * @param _roleGroup The role group.
   * @return true if so
   */
  function isRoleGroup(bytes32 _roleGroup) external view returns (bool);
  /**
   * @dev Get the list of roles in the given role group
   * @param _roleGroup The role group.
   * @return role list
   */
  function getRoleGroup(bytes32 _roleGroup) external view returns (bytes32[] memory);
  /**
   * @dev Get the list of role groups which contain given role
   * @param _role The role.
   * @return rolegroup list
   */
  function getRoleGroupsForRole(bytes32 _role) external view returns (bytes32[] memory);

  // roles

  /**
   * @dev Get whether given address has given role in the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @param _role The role.
   * @return true if so
   */
  function hasRole(bytes32 _context, address _addr, bytes32 _role) external view returns (bool);
  /**
   * @dev Get whether given address has any of the given roles in the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @param _roles The role list.
   * @return true if so
   */
  function hasAnyRole(bytes32 _context, address _addr, bytes32[] calldata _roles) external view returns (bool);
  /**
   * @dev Assign a role to the given address in the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @param _role The role.
   */
  function assignRole(bytes32 _context, address _addr, bytes32 _role) external;
  /**
   * @dev Remove a role from the given address in the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @param _role The role to unassign.
   */
  function unassignRole(bytes32 _context, address _addr, bytes32 _role) external;
  /**
   * @dev Get all role for given address in the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @return list of roles
   */
  function getRolesForUser(bytes32 _context, address _addr) external view returns (bytes32[] memory);

  // who can assign roles

  /**
   * @dev Add given rolegroup as an assigner for the given role.
   * @param _roleToAssign The role.
   * @param _assignerRoleGroup The role group that should be allowed to assign this role.
   */
  function addAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup) external;
  /**
   * @dev Remove given rolegroup as an assigner for the given role.
   * @param _roleToAssign The role.
   * @param _assignerRoleGroup The role group that should no longer be allowed to assign this role.
   */
  function removeAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup) external;
  /**
   * @dev Get all rolegroups that are assigners for the given role.
   * @param _role The role.
   * @return list of rolegroups
   */
  function getAssigners(bytes32 _role) external view returns (bytes32[] memory);
  /**
   * @dev Get whether given address can assign given role within the given context.
   * @param _context Context name.
   * @param _addr Address.
   * @param _role The role to assign.
   * @return true if so
   */
  function canAssign(bytes32 _context, address _addr, bytes32 _role) external view returns (bool);

  // utility methods

  /**
   * @dev Generate the context name which represents the given address.
   * @param _addr Address.
   * @return context name.
   */
  function generateContextFromAddress (address _addr) external pure returns (bytes32);

  event RoleGroupUpdated(bytes32 indexed roleGroup);
  event RoleAssigned(bytes32 indexed context, address indexed addr, bytes32 indexed role);
  event RoleUnassigned(bytes32 indexed context, address indexed addr, bytes32 indexed role);
  event AssignerAdded(bytes32 indexed role, bytes32 indexed roleGroup);
  event AssignerRemoved(bytes32 indexed role, bytes32 indexed roleGroup);
}

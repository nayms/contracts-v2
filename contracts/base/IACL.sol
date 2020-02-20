pragma solidity >=0.5.8;

interface IACL {
  // admin
  function isAdmin(address _addr) external view returns (bool);
  function addAdmin(address _addr) external;
  function removeAdmin(address _addr) external;
  // contexts
  function getNumContexts() external view returns (uint256);
  function getContextAtIndex(uint256 _index) external view returns (bytes32);
  function getNumUsersInContext(bytes32 _context) external view returns (uint256);
  function getUserInContextAtIndex(bytes32 _context, uint _index) external view returns (address);
  // users
  function getNumContextsForUser(address _addr) external view returns (uint256);
  function getContextForUserAtIndex(address _addr, uint256 _index) external view returns (bytes32);
  // role groups
  function hasRoleInGroup(bytes32 _context, address _addr, bytes32 _roleGroup) external view returns (bool);
  function setRoleGroup(bytes32 _roleGroup, bytes32[] calldata _roles) external;
  function isRoleGroup(bytes32 _roleGroup) external view returns (bool);
  function getRoleGroup(bytes32 _roleGroup) external view returns (bytes32[] memory);
  function getRoleGroupsForRole(bytes32 _role) external view returns (bytes32[] memory);
  // roles
  function hasRole(bytes32 _context, address _addr, bytes32 _role) external view returns (bool);
  function hasAnyRole(bytes32 _context, address _addr, bytes32[] calldata _roles) external view returns (bool);
  function assignRole(bytes32 _context, address _addr, bytes32 _role) external;
  function unassignRole(bytes32 _context, address _addr, bytes32 _role) external;
  function getRolesForUser(bytes32 _context, address _addr) external view returns (bytes32[] memory);
  // who can assign roles
  function addAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup) external;
  function removeAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup) external;
  function getAssigners(bytes32 _role) external view returns (bytes32[] memory);
  function canAssign(bytes32 _context, address _addr, bytes32 _role) external view returns (bool);

  event RoleGroupUpdated(bytes32 indexed roleGroup);
  event RoleAssigned(bytes32 indexed context, address indexed addr, bytes32 indexed role);
  event RoleUnassigned(bytes32 indexed context, address indexed addr, bytes32 indexed role);
  event AssignerAdded(bytes32 indexed role, bytes32 indexed roleGroup);
  event AssignerRemoved(bytes32 indexed role, bytes32 indexed roleGroup);
}

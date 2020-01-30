pragma solidity >=0.5.8;

interface IACL {
  // admin
  function isAdmin(address _addr) external view returns (bool);
  function proposeNewAdmin(address _addr) external;
  function cancelNewAdminProposal(address _addr) external;
  function acceptAdminRole() external;
  function removeAdmin(address _addr) external;
  // contexts
  function getNumContexts() external view returns (uint256);
  function getContext(uint256 _index) external view returns (string memory);
  // role groups
  function hasRoleInGroup(string calldata _context, address _addr, bytes32 _roleGroup) external view returns (bool);
  function setRoleGroup(bytes32 _roleGroup, bytes32[] calldata _roles) external;
  function getRoleGroup(bytes32 _roleGroup) external view returns (bytes32[] memory);
  function getRoleGroupsForRole(bytes32 _role) external view returns (bytes32[] memory);
  // roles
  function hasRole(string calldata _context, address _addr, bytes32 _role) external view returns (bool);
  function hasAnyRole(string calldata _context, address _addr, bytes32[] calldata _roles) external view returns (bool);
  function assignRole(string calldata _context, address _addr, bytes32 _role) external;
  function unassignRole(string calldata _context, address _addr, bytes32 _role) external;
  function getRolesForUser(string calldata _context, address _addr) external view returns (bytes32[] memory);
  // who can assign roles
  function addAssigner(bytes32 _assignerRole, bytes32 _role) external;
  function removeAssigner(bytes32 _assignerRole, bytes32 _role) external;
  function getAssigners(bytes32 _role) external view returns (bytes32[] memory);
  function canAssign(string calldata _context, address _addr, bytes32 _role) external view returns (bool);

  event RoleGroupUpdated(bytes32 indexed roleGroup);
  event RoleAssigned(string context, address indexed addr, bytes32 indexed role);
  event RoleUnassigned(string context, address indexed addr, bytes32 indexed role);
  event AssignerAdded(bytes32 indexed role, bytes32 indexed assigner);
  event AssignerRemoved(bytes32 indexed role, bytes32 indexed assigner);
  event AdminProposed(address indexed addr);
  event AdminProposalCancelled(address indexed addr);
  event AdminProposalAccepted(address indexed addr);
  event AdminRemoved(address indexed addr);
}

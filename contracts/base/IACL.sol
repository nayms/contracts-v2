pragma solidity >=0.5.8;

interface IACL {
  // admin
  function isAdmin(address _addr) external view returns (bool);
  function proposeNewAdmin(address _addr) external;
  function cancelNewAdminProposal(address _addr) external;
  function acceptAdminRole() external;
  function removeAdmin(address _addr) external;
  // role groups
  function hasRoleInGroup(string calldata _context, address _addr, bytes32 _roleGroup) external view returns (bool);
  function setRoleGroup(bytes32 _roleGroup, bytes32[] calldata _roles) external;
  // roles
  function hasRole(string calldata _context, address _addr, bytes32 _role) external view returns (bool);
  function hasAnyRole(string calldata _context, address _addr, bytes32[] calldata _roles) external view returns (bool);
  function assignRole(string calldata _context, address _addr, bytes32 _role) external;
  function unassignRole(string calldata _context, address _addr, bytes32 _role) external;
  // who can assign roles
  function addAssigner(bytes32 _assignerRole, bytes32 _role) external;
  function removeAssigner(bytes32 _assignerRole, bytes32 _role) external;
  function getAssigners(bytes32 _role) external view returns (bytes32[] memory);
  function canAssign(string calldata _context, address _addr, bytes32 _role) external view returns (bool);
}

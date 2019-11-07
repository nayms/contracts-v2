pragma solidity >=0.5.8;

interface IACL {
  // admin
  function isAdmin(address _addr) view external returns (bool);
  function proposeNewAdmin(address _addr) external;
  function cancelNewAdminProposal(address _addr) external;
  function acceptAdminRole() external;
  function removeAdmin(address _addr) external;
  // role groups
  function hasRoleInGroup(string calldata _context, bytes32 _roleGroup, address _addr) view external returns (bool);
  function setRoleGroup(bytes32 _roleGroup, bytes32[] calldata _roles) external;
  // roles
  function hasRole(string calldata _context, address _addr, bytes32 _role) view external returns (bool);
  function hasAnyRole(string calldata _context, address _addr, bytes32[] calldata _roles) view external returns (bool);
  function assignRole(string calldata _context, address _addr, bytes32 _role) external;
  function unassignRole(string calldata _context, address _addr, bytes32 _role) external;
  // role assigners
  function addAssigner(string calldata _context, address _addr, bytes32 _role) external;
  function removeAssigner(string calldata _context, address _addr, bytes32 _role) external;
  function isAssigner(string calldata _context, address _addr, bytes32 _role) view external returns (bool);
}

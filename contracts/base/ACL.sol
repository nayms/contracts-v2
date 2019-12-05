pragma solidity >=0.5.8;

import "./ACLRoles.sol";
import "./ACLAssigners.sol";
import "./IACL.sol";

contract ACL is IACL {
  using ACLRoles for ACLRoles.Context;
  using ACLAssigners for ACLAssigners.Role;

  mapping (string => ACLRoles.Context) private assignments;
  mapping (bytes32 => ACLAssigners.Role) private assigners;
  mapping (bytes32 => bytes32[]) public roleGroups;
  mapping (address => bool) public admins;
  mapping (address => bool) public pendingAdmins;
  uint256 public numAdmins;

  modifier assertIsAdmin () {
    require(admins[msg.sender], 'unauthorized - must be admin');
    _;
  }

  modifier assertIsAssigner (string memory _context, bytes32 _role) {
    // either they have the permission to assign or they're an admin
    require(canAssign(_context, msg.sender, _role) || isAdmin(msg.sender), 'unauthorized');
    _;
  }

  constructor () public {
    admins[msg.sender] = true;
    numAdmins = 1;
  }

  // Admins

  /**
   * @dev determine if addr is an admin
   */
  function isAdmin(address _addr) public view returns (bool) {
    return admins[_addr];
  }

  function proposeNewAdmin(address _addr) public assertIsAdmin {
    require(!admins[_addr], 'already an admin');
    require(!pendingAdmins[_addr], 'already proposed as an admin');
    pendingAdmins[_addr] = true;
    emit AdminProposed(_addr);
  }

  function cancelNewAdminProposal(address _addr) public assertIsAdmin {
    require(pendingAdmins[_addr], 'not proposed as an admin');
    pendingAdmins[_addr] = false;
    emit AdminProposalCancelled(_addr);
  }

  function acceptAdminRole() public {
    require(pendingAdmins[msg.sender], 'not proposed as an admin');
    pendingAdmins[msg.sender] = false;
    admins[msg.sender] = true;
    numAdmins++;
    emit AdminProposalAccepted(msg.sender);
  }

  function removeAdmin(address _addr) public assertIsAdmin {
    require(1 < numAdmins, 'cannot remove last admin');
    require(_addr != msg.sender, 'cannot remove oneself');
    require(admins[_addr], 'not an admin');
    admins[_addr] = false;
    numAdmins--;
    emit AdminRemoved(_addr);
  }

  // Role groups

  function hasRoleInGroup(string memory _context, address _addr, bytes32 _roleGroup) public view returns (bool) {
    return hasAnyRole(_context, _addr, roleGroups[_roleGroup]);
  }

  function setRoleGroup(bytes32 _roleGroup, bytes32[] memory _roles) public assertIsAdmin {
    roleGroups[_roleGroup] = _roles;

    emit RoleGroupUpdated(_roleGroup);
  }

  // Roles

  /**
   * @dev determine if addr has role
   */
  function hasRole(string memory _context, address _addr, bytes32 _role)
    public
    view
    returns (bool)
  {
    return assignments[_context].has(_role, _addr);
  }

  function hasAnyRole(string memory _context, address _addr, bytes32[] memory _roles)
    public
    view
    returns (bool)
  {
    bool hasAny = false;

    for (uint256 i = 0; i < _roles.length; i++) {
      if (hasRole(_context, _addr, _roles[i])) {
        hasAny = true;
        break;
      }
    }

    return hasAny;
  }

  /**
   * @dev assign a role to an address
   */
  function assignRole(string memory _context, address _addr, bytes32 _role)
    public
    assertIsAssigner(_context, _role)
  {
    assignments[_context].add(_role, _addr);
    emit RoleAssigned(_context, _addr, _role);
  }

  /**
   * @dev remove a role from an address
   */
  function unassignRole(string memory _context, address _addr, bytes32 _role)
    public
    assertIsAssigner(_context, _role)
  {
    assignments[_context].remove(_role, _addr);
    emit RoleUnassigned(_context, _addr, _role);
  }

  // Role assigners

  function addAssigner(bytes32 _role, bytes32 _assignerRole)
    public
    assertIsAdmin
  {
    assigners[_role].add(_assignerRole);
    emit AssignerAdded(_role, _assignerRole);
  }

  function removeAssigner(bytes32 _role, bytes32 _assignerRole)
    public
    assertIsAdmin
  {
    assigners[_role].remove(_assignerRole);
    emit AssignerRemoved(_role, _assignerRole);
  }

  function getAssigners(bytes32 _role)
    public
    view
    returns (bytes32[] memory)
  {
    return assigners[_role].all();
  }

  function canAssign(string memory _context, address _addr, bytes32 _role)
    public
    view
    returns (bool)
  {
    if (isAdmin(_addr)) {
      return true;
    }

    return hasAnyRole(_context, _addr, getAssigners(_role));
  }
}

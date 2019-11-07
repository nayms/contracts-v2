pragma solidity >=0.5.8;

import "./ACLRoles.sol";
import "./IACL.sol";

contract ACL is IACL {
  using ACLRoles for ACLRoles.Context;

  mapping (string => ACLRoles.Context) private assignments;
  mapping (string => ACLRoles.Context) private assigners;
  mapping (bytes32 => bytes32[]) public roleGroups;
  mapping (address => bool) public admins;
  mapping (address => bool) public pendingAdmins;
  uint256 public numAdmins;

  event RoleGroupUpdated(bytes32 indexed roleGroup);
  event RoleAssigned(string context, address indexed addr, bytes32 indexed role);
  event RoleUnassigned(string context, address indexed addr, bytes32 indexed role);
  event AssignerAdded(string context, address indexed addr, bytes32 indexed role);
  event AssignerRemoved(string context, address indexed addr, bytes32 indexed role);
  event AdminProposed(address indexed addr);
  event AdminProposalCancelled(address indexed addr);
  event AdminProposalAccepted(address indexed addr);
  event AdminRemoved(address indexed addr);

  modifier assertIsAdmin () {
    require(admins[msg.sender], 'unauthorized - must be admin');
    _;
  }

  modifier assertIsAssigner (string memory _context, bytes32 _role) {
    // either they have the permission to assign or they're an admin
    require(isAssigner(_context, msg.sender, _role) || isAdmin(msg.sender), 'unauthorized');
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
  function isAdmin(address _addr) view public returns (bool) {
    return admins[_addr];
  }

  function proposeNewAdmin(address _addr) assertIsAdmin public {
    require(!admins[_addr], 'already an admin');
    require(!pendingAdmins[_addr], 'already proposed as an admin');
    pendingAdmins[_addr] = true;
    emit AdminProposed(_addr);
  }

  function cancelNewAdminProposal(address _addr) assertIsAdmin public {
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

  function removeAdmin(address _addr) assertIsAdmin public {
    require(1 < numAdmins, 'cannot remove last admin');
    require(_addr != msg.sender, 'cannot remove oneself');
    require(admins[_addr], 'not an admin');
    admins[_addr] = false;
    numAdmins--;
    emit AdminRemoved(_addr);
  }

  // Role groups

  function hasRoleInGroup(string memory _context, bytes32 _roleGroup, address _addr) view public returns (bool) {
    return hasAnyRole(_context, _addr, roleGroups[_roleGroup]);
  }

  function setRoleGroup(bytes32 _roleGroup, bytes32[] memory _roles) assertIsAdmin public {
    roleGroups[_roleGroup] = _roles;

    emit RoleGroupUpdated(_roleGroup);
  }

  // Roles

  /**
   * @dev determine if addr has role
   */
  function hasRole(string memory _context, address _addr, bytes32 _role)
    view
    public
    returns (bool)
  {
    return assignments[_context].has(_role, _addr);
  }

  function hasAnyRole(string memory _context, address _addr, bytes32[] memory _roles)
    view
    public
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
    assertIsAssigner(_context, _role)
    public
  {
    assignments[_context].add(_role, _addr);
    emit RoleAssigned(_context, _addr, _role);
  }

  /**
   * @dev remove a role from an address
   */
  function unassignRole(string memory _context, address _addr, bytes32 _role)
    assertIsAssigner(_context, _role)
    public
  {
    assignments[_context].remove(_role, _addr);
    emit RoleUnassigned(_context, _addr, _role);
  }

  // Role assigners

  function addAssigner(string memory _context, address _addr, bytes32 _role)
    assertIsAdmin
    public
  {
    assigners[_context].add(_role, _addr);
    emit AssignerAdded(_context, _addr, _role);
  }

  function removeAssigner(string memory _context, address _addr, bytes32 _role)
    assertIsAdmin
    public
  {
    assigners[_context].remove(_role, _addr);
    emit AssignerRemoved(_context, _addr, _role);
  }

  function isAssigner(string memory _context, address _addr, bytes32 _role) view public returns (bool) {
    return assigners[_context].has(_role, _addr);
  }
}

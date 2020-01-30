pragma solidity >=0.5.8;

import "./base/IACL.sol";

/**
 * @title ACLRoles
 * @dev Library for managing addresses assigned to a Role within a context.
 */
library ACLRoles {
  struct User {
    mapping (bytes32 => uint256) map;
    bytes32[] list;
  }

  struct Context {
    mapping (address => User) users;
  }

  /**
   * @dev give an address access to this role
   */
  function add(Context storage _context, bytes32 _role, address _addr)
    internal
  {
    User storage u = _context.users[_addr];

    if (0 == u.map[_role]) {
      u.list.push(_role);
      u.map[_role] = u.list.length;
    }
  }

  /**
   * @dev remove an address' access to this role
   */
  function remove(Context storage _context, bytes32 _role, address _addr)
    internal
  {
    User storage u = _context.users[_addr];

    uint256 idx = u.map[_role];

    if (0 < idx) {
      uint256 actualIdx = idx - 1;

      // replace item to remove with last item in list and update mappings
      if (u.list.length - 1 > actualIdx) {
        u.list[actualIdx] = u.list[u.list.length - 1];
        u.map[u.list[actualIdx]] = actualIdx + 1;
      }

      u.list.length--;
      u.map[_role] = 0;
    }
  }

  /**
   * @dev check if an address has this role
   * @return bool
   */
  function has(Context storage _context, bytes32 _role, address _addr)
    internal
    view
    returns (bool)
  {
    User storage u = _context.users[_addr];

    return (0 < u.map[_role]);
  }


  /**
   * @dev get all roles for address
   * @return bytes32[]
   */
  function getRolesForUser(Context storage _context, address _addr)
    internal
    view
    returns (bytes32[] storage)
  {
    User storage u = _context.users[_addr];

    return u.list;
  }
}


/**
 * @title ACLAssigners
 * @dev Library for managing assigners of a Role.
 */
library ACLAssigners {
  struct Role {
    mapping (bytes32 => uint256) map;
    bytes32[] list;
  }

  /**
   * @dev add an assigner for this role
   */
  function add(Role storage _role, bytes32 _assignerRole)
    internal
  {
    if (0 == _role.map[_assignerRole]) {
      _role.list.push(_assignerRole);
      _role.map[_assignerRole] = _role.list.length;
    }
  }

  /**
   * @dev remove an assigner for this role
   */
  function remove(Role storage _role, bytes32 _assignerRole)
    internal
  {
    uint256 idx = _role.map[_assignerRole];

    if (0 < idx) {
      uint256 actualIdx = idx - 1;

      // replace item to remove with last item in list and update mappings
      if (_role.list.length - 1 > actualIdx) {
        _role.list[actualIdx] = _role.list[_role.list.length - 1];
        _role.map[_role.list[actualIdx]] = actualIdx + 1;
      }

      _role.list.length--;
      _role.map[_assignerRole] = 0;
    }
  }


  /**
   * @dev Get all assigners.
   */
  function getAll(Role storage _role)
    internal
    view
    returns (bytes32[] storage)
  {
    return _role.list;
  }
}


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

  function getRolesForUser(string memory _context, address _addr) public view returns (bytes32[] memory) {
    return assignments[_context].getRolesForUser(_addr);
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
    return assigners[_role].getAll();
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

pragma solidity >=0.5.8;

import "./base/IACL.sol";
import "./base/SafeMath.sol";

/**
 * @dev Library for managing addresses assigned to a Role within a context.
 */
library Assignments {
  using SafeMath for *;

  struct UserRoles {
    mapping (bytes32 => uint256) map;
    bytes32[] list;
  }

  struct Context {
    mapping (address => UserRoles) userRoles;
    mapping (address => uint256) userMap;
    address[] userList;
  }

  /**
   * @dev give an address access to a role
   */
  function addRoleForUser(Context storage _context, bytes32 _role, address _addr)
    internal
  {
    UserRoles storage ur = _context.userRoles[_addr];

    // new user?
    if (_context.userMap[_addr] == 0) {
      _context.userList.push(_addr);
      _context.userMap[_addr] = _context.userList.length;
    }

    // set role for user
    if (ur.map[_role] == 0) {
      ur.list.push(_role);
      ur.map[_role] = ur.list.length;
    }
  }

  /**
   * @dev remove an address' access to a role
   */
  function removeRoleForUser(Context storage _context, bytes32 _role, address _addr)
    internal
  {
    UserRoles storage ur = _context.userRoles[_addr];

    uint256 idx = ur.map[_role];

    if (idx > 0) {
      uint256 actualIdx = idx.sub(1);

      // replace item to remove with last item in list and update mappings
      if (ur.list.length.sub(1) > actualIdx) {
        ur.list[actualIdx] = ur.list[ur.list.length.sub(1)];
        ur.map[ur.list[actualIdx]] = actualIdx.add(1);
      }

      ur.list.length = ur.list.length.sub(1);
      ur.map[_role] = 0;
    }

    // remove user if they don't have roles anymore
    if (ur.list.length == 0) {
      uint256 actualIdx = _context.userMap[_addr].sub(1);

      // replace item to remove with last item in list and update mappings
      if (_context.userList.length.sub(1) > actualIdx) {
        _context.userList[actualIdx] = _context.userList[_context.userList.length.sub(1)];
        _context.userMap[_context.userList[actualIdx]] = actualIdx.add(1);
      }

      _context.userList.length = _context.userList.length.sub(1);
      _context.userMap[_addr] = 0;
    }
  }

  /**
   * @dev check if an address has a role
   * @return bool
   */
  function hasRoleForUser(Context storage _context, bytes32 _role, address _addr)
    internal
    view
    returns (bool)
  {
    UserRoles storage ur = _context.userRoles[_addr];

    return (ur.map[_role] > 0);
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
    UserRoles storage ur = _context.userRoles[_addr];

    return ur.list;
  }


  /**
   * @dev get number of addresses with roles
   * @return uint256
   */
  function getNumUsers(Context storage _context)
    internal
    view
    returns (uint256)
  {
    return _context.userList.length;
  }


  /**
   * @dev get addresses at given index in list of addresses
   * @return uint256
   */
  function getUserAtIndex(Context storage _context, uint256 _index)
    internal
    view
    returns (address)
  {
    return _context.userList[_index];
  }


  /**
   * @dev get whether given addresses has a role in this context
   * @return uint256
   */
  function hasUser(Context storage _context, address _addr)
    internal
    view
    returns (bool)
  {
    return _context.userMap[_addr] != 0;
  }
}


/**
 * @dev Library for lists of byte32 value.
 */
library Bytes32 {
  using SafeMath for *;

  struct Set {
    mapping (bytes32 => uint256) map;
    bytes32[] list;
  }

  /**
   * @dev add a value
   */
  function add(Set storage _obj, bytes32 _assignerRole)
    internal
  {
    if (_obj.map[_assignerRole] == 0) {
      _obj.list.push(_assignerRole);
      _obj.map[_assignerRole] = _obj.list.length;
    }
  }

  /**
   * @dev remove an value for this role
   */
  function remove(Set storage _obj, bytes32 _assignerRole)
    internal
  {
    uint256 idx = _obj.map[_assignerRole];

    if (idx > 0) {
      uint256 actualIdx = idx.sub(1);

      // replace item to remove with last item in list and update mappings
      if (_obj.list.length.sub(1) > actualIdx) {
        _obj.list[actualIdx] = _obj.list[_obj.list.length.sub(1)];
        _obj.map[_obj.list[actualIdx]] = actualIdx.add(1);
      }

      _obj.list.length = _obj.list.length.sub(1);
      _obj.map[_assignerRole] = 0;
    }
  }

  /**
   * @dev remove all values
   */
  function clear(Set storage _obj)
    internal
  {
    for (uint i = 0; i < _obj.list.length; i += 1) {
      _obj.map[_obj.list[i]] = 0;
    }

    _obj.list.length = 0;
  }

  /**
   * @dev get no. of values
   */
  function size(Set storage _obj)
    internal
    view
    returns (uint256)
  {
    return _obj.list.length;
  }

  /**
   * @dev get value at index.
   */
  function get(Set storage _obj, uint256 _index)
    internal
    view
    returns (bytes32)
  {
    return _obj.list[_index];
  }

  /**
   * @dev Get all values.
   */
  function getAll(Set storage _obj)
    internal
    view
    returns (bytes32[] storage)
  {
    return _obj.list;
  }
}


contract ACL is IACL {
  using Assignments for Assignments.Context;
  using Bytes32 for Bytes32.Set;

  mapping (bytes32 => Assignments.Context) private assignments;
  mapping (bytes32 => Bytes32.Set) private assigners;
  mapping (bytes32 => Bytes32.Set) private roleToGroups;
  mapping (bytes32 => Bytes32.Set) private groupToRoles;
  mapping (address => Bytes32.Set) private userContexts;

  mapping (uint256 => bytes32) public contexts;
  mapping (bytes32 => bool) public isContext;
  uint256 public numContexts;

  bytes32 public adminRole;
  bytes32 public adminRoleGroup;
  bytes32 public systemContext;

  modifier assertIsAdmin () {
    require(isAdmin(msg.sender), 'unauthorized - must be admin');
    _;
  }

  modifier assertIsAssigner (bytes32 _context, bytes32 _role) {
    // either they have the permission to assign or they're an admin
    require(isAdmin(msg.sender) || canAssign(_context, msg.sender, _role), 'unauthorized');
    _;
  }

  modifier assertIsRoleGroup (bytes32 _roleGroup) {
    require(isRoleGroup(_roleGroup), 'must be role group');
    _;
  }

  constructor (bytes32 _adminRole, bytes32 _adminRoleGroup) public {
    adminRole = _adminRole;
    adminRoleGroup = _adminRoleGroup;
    systemContext = keccak256(abi.encodePacked(address(this)));

    // setup admin rolegroup
    bytes32[] memory roles = new bytes32[](1);
    roles[0] = _adminRole;
    _setRoleGroup(adminRoleGroup, roles);

    // set creator as admin
    _assignRole(systemContext, msg.sender, _adminRole);
  }

  // Admins

  function isAdmin(address _addr) public view returns (bool) {
    return hasRoleInGroup(systemContext, _addr, adminRoleGroup);
  }

  function addAdmin(address _addr) public {
    assignRole(systemContext, _addr, adminRole);
  }

  function removeAdmin(address _addr) public {
    unassignRole(systemContext, _addr, adminRole);
  }

  // Contexts

  function getNumContexts() public view returns (uint256) {
    return numContexts;
  }

  function getContextAtIndex(uint256 _index) public view returns (bytes32) {
    return contexts[_index];
  }

  function getNumUsersInContext(bytes32 _context) public view returns (uint256) {
    return assignments[_context].getNumUsers();
  }

  function getUserInContextAtIndex(bytes32 _context, uint _index) public view returns (address) {
    return assignments[_context].getUserAtIndex(_index);
  }

  // Users

  function getNumContextsForUser(address _addr) public view returns (uint256) {
    return userContexts[_addr].size();
  }

  function getContextForUserAtIndex(address _addr, uint256 _index) public view returns (bytes32) {
    return userContexts[_addr].get(_index);
  }

  // Role groups

  function hasRoleInGroup(bytes32 _context, address _addr, bytes32 _roleGroup) public view returns (bool) {
    return hasAnyRole(_context, _addr, groupToRoles[_roleGroup].getAll());
  }

  function setRoleGroup(bytes32 _roleGroup, bytes32[] memory _roles) public assertIsAdmin {
    _setRoleGroup(_roleGroup, _roles);
  }

  function getRoleGroup(bytes32 _roleGroup) public view returns (bytes32[] memory) {
    return groupToRoles[_roleGroup].getAll();
  }

  function isRoleGroup(bytes32 _roleGroup) public view returns (bool) {
    return getRoleGroup(_roleGroup).length > 0;
  }

  function getRoleGroupsForRole(bytes32 _role) public view returns (bytes32[] memory) {
    return roleToGroups[_role].getAll();
  }

  // Roles

  /**
   * @dev determine if addr has role
   */
  function hasRole(bytes32 _context, address _addr, bytes32 _role)
    public
    view
    returns (bool)
  {
    return assignments[_context].hasRoleForUser(_role, _addr) || assignments[systemContext].hasRoleForUser(_role, _addr);
  }

  function hasAnyRole(bytes32 _context, address _addr, bytes32[] memory _roles)
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
  function assignRole(bytes32 _context, address _addr, bytes32 _role)
    public
    assertIsAssigner(_context, _role)
  {
    _assignRole(_context, _addr, _role);
  }


  /**
   * @dev remove a role from an address
   */
  function unassignRole(bytes32 _context, address _addr, bytes32 _role)
    public
    assertIsAssigner(_context, _role)
  {
    if (assignments[_context].hasRoleForUser(_role, _addr)) {
      assignments[_context].removeRoleForUser(_role, _addr);
    }

    // update user's context list?
    if (!assignments[_context].hasUser(_addr)) {
      userContexts[_addr].remove(_context);
    }

    emit RoleUnassigned(_context, _addr, _role);
  }

  function getRolesForUser(bytes32 _context, address _addr) public view returns (bytes32[] memory) {
    return assignments[_context].getRolesForUser(_addr);
  }

  // Role assigners

  function addAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup)
    public
    assertIsAdmin
    assertIsRoleGroup(_assignerRoleGroup)
  {
    assigners[_roleToAssign].add(_assignerRoleGroup);
    emit AssignerAdded(_roleToAssign, _assignerRoleGroup);
  }

  function removeAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup)
    public
    assertIsAdmin
    assertIsRoleGroup(_assignerRoleGroup)
  {
    assigners[_roleToAssign].remove(_assignerRoleGroup);
    emit AssignerRemoved(_roleToAssign, _assignerRoleGroup);
  }

  function getAssigners(bytes32 _role)
    public
    view
    returns (bytes32[] memory)
  {
    return assigners[_role].getAll();
  }

  function canAssign(bytes32 _context, address _addr, bytes32 _role)
    public
    view
    returns (bool)
  {
    if (isAdmin(_addr)) {
      return true;
    }

    bytes32[] memory roleGroups = getAssigners(_role);

    for (uint256 i = 0; i < roleGroups.length; i++) {
      bytes32[] memory roles = getRoleGroup(roleGroups[i]);

      if (hasAnyRole(_context, _addr, roles)) {
        return true;
      }
    }

    return false;
  }

  // Internal functions

  /**
   * @dev assign a role to an address
   */
  function _assignRole(bytes32 _context, address _addr, bytes32 _role) private {
    // record new context if necessary
    if (!isContext[_context]) {
      contexts[numContexts] = _context;
      isContext[_context] = true;
      numContexts++;
    }

    assignments[_context].addRoleForUser(_role, _addr);

    // update user's context list
    userContexts[_addr].add(_context);

    // only admin should be able to assign somebody in the system context
    if (_context == systemContext) {
      require(isAdmin(msg.sender), 'only admin can assign role in system context');
    }

    emit RoleAssigned(_context, _addr, _role);
  }

  function _setRoleGroup(bytes32 _roleGroup, bytes32[] memory _roles) private {
    // remove old roles
    bytes32[] storage oldRoles = groupToRoles[_roleGroup].getAll();

    for (uint256 i = 0; i < oldRoles.length; i += 1) {
      bytes32 r = oldRoles[i];
      roleToGroups[r].remove(_roleGroup);
    }

    groupToRoles[_roleGroup].clear();

    // set new roles
    for (uint256 i = 0; i < _roles.length; i += 1) {
      bytes32 r = _roles[i];
      roleToGroups[r].add(_roleGroup);
      groupToRoles[_roleGroup].add(r);
    }

    emit RoleGroupUpdated(_roleGroup);
  }
}

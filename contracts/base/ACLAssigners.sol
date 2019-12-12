pragma solidity >=0.5.8;


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
    if (0 >= _role.map[_assignerRole]) {
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
        _role.map[_role.list[actualIdx]] - actualIdx;
      }

      _role.list.length--;
      _role.map[_assignerRole] = 0;
    }
  }


  /**
   * @dev Get all assigners.
   */
  function all(Role storage _role)
    internal
    view
    returns (bytes32[] storage)
  {
    return _role.list;
  }
}

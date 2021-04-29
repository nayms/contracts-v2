pragma solidity 0.6.12;

/**
 * @dev ACL Constants.
 */
abstract contract IACLConstants {
  // used by canAssign() method
  uint256 constant public CANNOT_ASSIGN = 0;
  uint256 constant public CAN_ASSIGN_IS_ADMIN = 1;
  uint256 constant public CAN_ASSIGN_IS_OWN_CONTEXT = 2;
  uint256 constant public CAN_ASSIGN_HAS_ROLE = 3;

  // used by hasRole() method
  uint256 constant public DOES_NOT_HAVE_ROLE = 0;
  uint256 constant public HAS_ROLE_CONTEXT = 1;
  uint256 constant public HAS_ROLE_SYSTEM_CONTEXT = 2;
}
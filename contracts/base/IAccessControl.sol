// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./IACL.sol";

interface IAccessControl {
  /**
   * @dev Check if given address has admin privileges.
   * @param _addr Address to check.
   * @return true if so
   */
  function isAdmin (address _addr) external view returns (bool);

  /**
   * @dev Check if given address has a role in the given role group in the current context.
   * @param _addr Address to check.
   * @param _roleGroup Rolegroup to check against.
   * @return true if so
   */
  function inRoleGroup (address _addr, bytes32 _roleGroup) external view returns (bool);

  /**
   * @dev Check if given address has a role in the given rolegroup in the given context.
   * @param _ctx Context to check against.
   * @param _addr Address to check.
   * @param _roleGroup Role group to check against.
   * @return true if so
   */
  function inRoleGroupWithContext (bytes32 _ctx, address _addr, bytes32 _roleGroup) external view returns (bool);

  /**
   * @dev Get ACL reference.
   * @return ACL reference.
   */
  function acl () external view returns (IACL);

  /**
   * @dev Get current ACL context.
   * @return the context.
   */
  function aclContext () external view returns (bytes32);
}

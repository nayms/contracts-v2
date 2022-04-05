// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import {NaymsMock} from "../mocks/NaymsMock.sol";

import {IACL} from "../../../../contracts/base/IACL.sol";

contract NaymsUser {
    NaymsMock public nayms;
    
    constructor(NaymsMock _nayms) {
        nayms = _nayms;
    }
    
    function isAdmin(address _addr) external view returns (bool) {
        return IACL(address(nayms)).isAdmin(_addr);
    }
    

    function addAdmin(address _addr) external {
        IACL(address(nayms)).addAdmin(_addr);
    }

    function removeAdmin(address _addr) external {
        IACL(address(nayms)).removeAdmin(_addr);
    }

    function getNumContexts() external view returns (uint256) {
        return IACL(address(nayms)).getNumContexts();
    }

    function getContextAtIndex(uint256 _index) external view returns (bytes32) {
        return IACL(address(nayms)).getContextAtIndex(_index);
    }

    function getNumUsersInContext(bytes32 _context) external view returns (uint256) {
        return IACL(address(nayms)).getNumUsersInContext(_context);
    }

    function getUserInContextAtIndex(bytes32 _context, uint256 _index) external view returns (address) {
        return IACL(address(nayms)).getUserInContextAtIndex(_context, _index);
    }

    function getNumContextsForUser(address _addr) external view returns (uint256) {
        return IACL(address(nayms)).getNumContextsForUser(_addr);
    }

    function getContextForUserAtIndex(address _addr, uint256 _index) external view returns (bytes32) {
        return IACL(address(nayms)).getContextForUserAtIndex(_addr, _index);
    }

    function userSomeHasRoleInContext(bytes32 _context, address _addr) external view returns (bool) {
        return IACL(address(nayms)).userSomeHasRoleInContext(_context, _addr);
    }

    function hasRoleInGroup(
        bytes32 _context,
        address _addr,
        bytes32 _roleGroup
    ) external view returns (bool) {
        return IACL(address(nayms)).hasRoleInGroup(_context, _addr, _roleGroup);
    }

    function setRoleGroup(
        bytes32 _roleGroup,
        bytes32[] calldata _roles
    ) external {
        return IACL(address(nayms)).setRoleGroup(_roleGroup, _roles);
    }

    function isRoleGroup(bytes32 _roleGroup) external view returns (bool) {
        return IACL(address(nayms)).isRoleGroup(_roleGroup);
    }

    function getRoleGroup(bytes32 _roleGroup) external view returns (bytes32[] memory) {
        return IACL(address(nayms)).getRoleGroup(_roleGroup);
    }

    // function getRoleGroup(bytes32 _roleGroup) external view returns (bytes32[] memory) {
    //     return IACL(address(nayms)).getRoleGroup(_roleGroup);
    // }

    function getRoleGroupsForRole(bytes32 _role) external view returns (bytes32[] memory) {
        return IACL(address(nayms)).getRoleGroupsForRole(_role);
    }

    function hasRole(
        bytes32 _context,
        address _addr,
        bytes32 _role
    ) external view returns (uint256) {
        return IACL(address(nayms)).hasRole(_context, _addr, _role);
    }

    function hasAnyRole(
        bytes32 _context,
        address _addr,
        bytes32[] calldata _roles
    ) external view returns (bool) {
        return IACL(address(nayms)).hasAnyRole(_context, _addr, _roles);
    }

    // function assignRole(
    //     bytes32 _context,
    //     address _addr,
    //     bytes32 _role
    // ) external {
    //     return IACL(address(nayms)).assignRole(_context, _addr, _role);
    // }

    // todo modifier
    function assignRole(
        bytes32 _context,
        address _addr,
        bytes32 _role
    ) external {
        return IACL(address(nayms)).assignRole(_context, _addr, _role);
    }

    function unassignRole(
        bytes32 _context,
        address _addr,
        bytes32 _role
    ) external {
        return IACL(address(nayms)).unassignRole(_context, _addr, _role);
    }

    function getRolesForUser(bytes32 _context, address _addr) external view returns (bytes32[] memory) {
        return IACL(address(nayms)).getRolesForUser(_context, _addr);
    }

    function getUsersForRole(bytes32 _context, bytes32 _role) external view returns (address[] memory) {
        return IACL(address(nayms)).getUsersForRole(_context, _role);
    }

    function addAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup) external {
        IACL(address(nayms)).addAssigner(_roleToAssign, _assignerRoleGroup);
    }

    function removeAssigner(bytes32 _roleToAssign, bytes32 _assignerRoleGroup) external {
        IACL(address(nayms)).removeAssigner(_roleToAssign, _assignerRoleGroup);
    }

    function getAssigners(bytes32 _role) external view returns (bytes32[] memory) {
        return IACL(address(nayms)).getAssigners(_role);
    }

    // function canAssign(
    //     bytes32 _context,
    //     address _assigner,
    //     address _assignee,
    //     bytes32 _role
    // ) external view returns (uint256) {
    //     return IACL(address(nayms)).canAssign(_context, _assigner, _assignee, _role);
    // }
    function canAssign(
        bytes32 _context,
        address _assigner,
        address _assignee,
        bytes32 _role
    ) external view returns (uint256) {
        return IACL(address(nayms)).canAssign(_context, _assigner, _assignee, _role);
    }

    function generateContextFromAddress(address _addr) external view returns (bytes32) {
        return IACL(address(nayms)).generateContextFromAddress(_addr);
    }
}
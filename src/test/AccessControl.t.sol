// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./utils/DSTestPlusF.sol";

import {IACLConstants} from "../../contracts/base/IACLConstants.sol";
import {AccessControl} from "../../contracts/base/AccessControl.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from "../../contracts/Settings.sol";

contract AccessControlTest is DSTestPlusF, IACLConstants {
    ACL internal acl;
    Settings internal settings;
    AccessControl internal accessControl;

    /// @dev The state of the contract gets reset before each
    /// test is run, with the `setUp()` function being called
    /// each time after deployment.
    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        accessControl = new AccessControl(address(settings));
    }

    function testInRoleGroup() public {
        assertTrue(accessControl.inRoleGroup(address(this), ROLEGROUP_SYSTEM_ADMINS));
    }

    function testFalseInRoleGroup() public view {
        accessControl.inRoleGroup(address(this), ROLEGROUP_SYSTEM_MANAGERS);
    }

    function testInRoleGroupWithContext() public {
        acl.assignRole(accessControl.aclContext(), address(this), ROLE_SYSTEM_MANAGER);

        accessControl.inRoleGroupWithContext(accessControl.aclContext(), address(this), ROLEGROUP_SYSTEM_MANAGERS);
    }

    function testFalseInRoleGroupWithContext() public {
        acl.assignRole(acl.generateContextFromAddress(address(0xBEEF)), address(this), ROLE_SYSTEM_MANAGER);

        accessControl.inRoleGroupWithContext(accessControl.aclContext(), address(this), ROLEGROUP_SYSTEM_MANAGERS);
    }
}

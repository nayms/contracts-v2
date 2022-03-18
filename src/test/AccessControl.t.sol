// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "ds-test/test.sol";
import "forge-std/stdlib.sol";
import "forge-std/Vm.sol";
import "./utils/Console.sol";

import "../../contracts/base/AccessControl.sol";
import "../../contracts/ACL.sol";
import "../../contracts/Settings.sol";

contract AccessControlTest is DSTest {
    // using stdStorage for StdStorage;
    // StdStorage public stdstore;
    Vm public constant VM = Vm(HEVM_ADDRESS);
    
    ACL acl;
    Settings settings;
    AccessControl accessControl;


    /// @dev The state of the contract gets reset before each
    /// test is run, with the `setUp()` function being called
    /// each time after deployment.
    function setUp() public {
        // acl = new ACL(keccak256("ROLE_SYSTEM_ADMIN"), keccak256("ROLEGROUP_SYSTEM_ADMINS"));
        acl = new ACL(keccak256("ROLE_SYSTEM_ADMIN"), keccak256("ROLEGROUP_SYSTEM_ADMINS"));
        settings = new Settings(address(acl));
        accessControl = new AccessControl(address(settings));
    }

    function testCheckFoundrySetup() public {
        assertTrue(true);
    }

    function testInRoleGroup() public {
        assertTrue(accessControl.inRoleGroup(address(this),  acl.ROLEGROUP_SYSTEM_ADMINS()));
    }

    function testFalseInRoleGroup() public view {
        accessControl.inRoleGroup(address(this),  keccak256("ROLEGROUP_SYSTEM_MANAGERS"));
    }

    function testInRoleGroupWithContext() public {
        acl.assignRole(accessControl.aclContext(), address(this), keccak256("ROLE_SYSTEM_MANAGER"));

        accessControl.inRoleGroupWithContext(accessControl.aclContext(), address(this),  keccak256("ROLEGROUP_SYSTEM_MANAGERS"));
    }

    function testFalseInRoleGroupWithContext() public {
        acl.assignRole(acl.generateContextFromAddress(address(0xBEEF)), address(this), keccak256("ROLE_SYSTEM_MANAGER"));

        accessControl.inRoleGroupWithContext(accessControl.aclContext(), address(this),  keccak256("ROLEGROUP_SYSTEM_MANAGERS"));
    }
}

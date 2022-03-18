// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./utils/DSTestPlusF.sol";

import {IACLConstants} from  "../../contracts/base/IACLConstants.sol";
import "../../contracts/base/AccessControl.sol";
import "../../contracts/ACL.sol";
import "../../contracts/Settings.sol";

import {NaymsMock} from "./utils/mocks/NaymsMock.sol";
import {NaymsUser} from "./utils/users/NaymsUser.sol";

import {ConstantsTest} from "./utils/ConstantsTest.sol";

contract AclTest is DSTestPlusF, IACLConstants, ConstantsTest {
    
    ACL internal acl;
    Settings internal settings;
    AccessControl internal accessControl;
    
    NaymsMock internal nayms;
    NaymsUser internal alice; // 0
    NaymsUser internal bob;  // 1
    NaymsUser internal charlie; // 2
    NaymsUser internal daisy; // 3
    NaymsUser internal emma; // 4
    
    bytes32 internal systemContext;
    
    event RoleGroupUpdated(bytes32 indexed roleGroup);
    event RoleAssigned(bytes32 indexed context, address indexed addr, bytes32 indexed role);

    /// @dev The state of the contract gets reset before each
    /// test is run, with the `setUp()` function being called
    /// each time after deployment.
    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        accessControl = new AccessControl(address(settings));

        nayms = new NaymsMock();
        alice = new NaymsUser(nayms);
        bob = new NaymsUser(nayms);
        charlie = new NaymsUser(nayms);
        daisy = new NaymsUser(nayms);
        emma = new NaymsUser(nayms);
        
        systemContext = nayms.systemContext();
        
        IACL(address(nayms)).addAdmin(address(alice));
        alice.removeAdmin(address(nayms));
    }

    // default account is initial admin
    function testIsAdmin() public {
        assertTrue(acl.isAdmin(address(this)));
    }

    function testFalseIsAdmin() public view {
        acl.isAdmin(address(0xBEEF));
    }

    // can have new admin added, but not by a non-admin
    function testRevertAddAdmin() public {
        vm.expectRevert("unauthorized");
        vm.prank(address(0xCAFE));
        acl.addAdmin(address(0xBEEF));
    }

    // can have new admin added, by an admin
    function testAddAdmin() public {
        acl.addAdmin(address(0xBEEF));
        uint256 num = acl.getNumUsersInContext(acl.systemContext());
        assertEq(num, 2);
        console.log("getNumUsersInContext", num);
        assertTrue(acl.isAdmin(address(0xBEEF)));
    }

    // can have new admin added, and makes no difference if they get added again
    function testAddRedundantAdmin() public {
        acl.addAdmin(address(0xBEEF));
        acl.addAdmin(address(0xBEEF));
        assertEq(acl.getNumUsersInContext(acl.systemContext()), 2);
        assertTrue(acl.isAdmin(address(0xBEEF)));
    }

    // can have new admin added, and emits an event when successful
    function testAddAdminEvents() public {
        alice.assignRole(systemContext, address(charlie), ROLE_APPROVED_USER);

        vm.expectEmit(true, true, true, true);
        emit RoleAssigned(C1, address(charlie), R1);
        alice.assignRole(C1, address(charlie), R1);
    }

    // 98 can have someone removed as admin
    function testRemoveAdmin() public {
        acl.addAdmin(address(0xCAFE));
        assertEq(acl.getNumUsersInContext(acl.systemContext()), 2); 
        assertTrue(acl.isAdmin(address(0xCAFE)));
 
        acl.removeAdmin(address(0xCAFE));
    }

    // can have someone removed as admin, but not by a non-admin 
    function testRevertRemoveAdmin() public {
        acl.addAdmin(address(0xCAFE));
        assertEq(acl.getNumUsersInContext(acl.systemContext()), 2); 
        assertTrue(acl.isAdmin(address(0xCAFE)));
 
        vm.expectRevert("unauthorized");
        vm.prank(address(0xBEEF));
        acl.removeAdmin(address(0xCAFE));
    }

    // 109 can have someone removed as admin, by another admin
    function testFalseRemoveAdmin() public {
        acl.addAdmin(address(0xCAFE));
        assertEq(acl.getNumUsersInContext(acl.systemContext()), 2); 
        assertTrue(acl.isAdmin(address(0xCAFE)));

        // another admin is able to remove an admin
        vm.prank(address(0xCAFE));
        acl.removeAdmin(address(this));

        assertEq(acl.getNumUsersInContext(acl.systemContext()), 1);
        acl.isAdmin(address(this));
    }

    // can have someone removed as admin, and it makes no difference if they are removed twice
    function testRemoveRedundantAdmin() public {
        acl.addAdmin(address(0xCAFE));
        assertEq(acl.getNumUsersInContext(acl.systemContext()), 2); 
        assertTrue(acl.isAdmin(address(0xCAFE)));
 
        acl.removeAdmin(address(0xCAFE));
        acl.removeAdmin(address(0xCAFE));
    }

    // can have someone removed as admin, and it makes no difference if they removed themselves
    function testRemoveAdminThemselves() public {
        acl.addAdmin(address(0xCAFE));
        assertEq(acl.getNumUsersInContext(acl.systemContext()), 2); 
        assertTrue(acl.isAdmin(address(0xCAFE)));

        acl.removeAdmin(address(this));
        assertTrue(acl.isAdmin(address(0xCAFE)));

        assertEq(acl.getNumUsersInContext(acl.systemContext()), 1); 

        assertEq(acl.getUserInContextAtIndex(acl.systemContext(), 0), address(0xCAFE));
    }

    // 271 can have someone removed as admin, and emits an event when successful
    function testRemoveAdminCheckEvent() public {
        acl.addAdmin(address(0xCAFE));
        assertEq(acl.getNumUsersInContext(acl.systemContext()), 2); 
        assertTrue(acl.isAdmin(address(0xCAFE)));

        vm.expectEmit(true, true, true, true); // works
        emit RoleAssigned(C1, address(0xBEEF), R1);
        acl.assignRole(C1, address(0xBEEF), R1);
    }

    // todo: if only 1 admin, can admin be removed?


    // can have a role group set, but not by a non-admin
    function testSetRoleGroupByNonAdmin() public {
        bytes32[] memory rolesArray = new bytes32[](2);
        rolesArray[0] =  R1;
        rolesArray[1] =  R2;

        vm.expectRevert("unauthorized");
        vm.prank(address(0xCAFE));
        acl.addAdmin(address(0xBEEF));
        acl.setRoleGroup(G1, rolesArray);
    }

    // can have a role group set, by an admin
    function testSetRoleGroupByAdmin() public {
        bytes32[] memory rolesArray = new bytes32[](2);
        rolesArray[0] =  R1;
        rolesArray[1] =  R2;

        acl.setRoleGroup(G1, rolesArray);

        assertEq32(acl.getRoleGroup(G1)[0], R1);
        assertEq32(acl.getRoleGroup(G1)[1], R2);
    }

    // can have a role group set, and it updates its internal data correctly
    function testSetRoleGroupCheckStateUpdates() public {
        bytes32[] memory rolesArray = new bytes32[](2);
        rolesArray[0] = R1;
        rolesArray[1] = R2;
        bytes32[] memory rolesArray2 = new bytes32[](2);
        rolesArray2[0] = R2;
        rolesArray2[1] = R3;

        acl.setRoleGroup(G1, rolesArray);
        acl.setRoleGroup(G2, rolesArray2);

        emit log_named_bytes32("bytes32", acl.getRoleGroupsForRole(R1)[0]);
        // todo: getRoleGroupsForRole - no bounds when group is not in the array and causes out of gas
        assertEq32(acl.getRoleGroupsForRole(R1)[0], G1);
        assertEq32(acl.getRoleGroupsForRole(R2)[0], G1);
        assertEq32(acl.getRoleGroupsForRole(R2)[1], G2);
        assertEq32(acl.getRoleGroupsForRole(R3)[0], G2);

        bytes32[] memory rolesArray3 = new bytes32[](1);
        rolesArray3[0] = R3;

        acl.setRoleGroup(G1, rolesArray3);
        // assertEq32(acl.getRoleGroupsForRole(R1)[0], 0); // todo: out of gas
        assertEq32(acl.getRoleGroupsForRole(R2)[0], G2);
        assertEq32(acl.getRoleGroupsForRole(R3)[0], G2);
        assertEq32(acl.getRoleGroupsForRole(R3)[1], G1);

        // get roles here and check
        assertEq(acl.getRoleGroup(G1)[0], R3);
        assertEq(acl.getRoleGroup(G2)[0], R2);
        assertEq(acl.getRoleGroup(G2)[1], R3);
    }

    // can have a role assigned, and it works with role checking
    function testFalseSetRoleGroupChecking() public {
        acl.assignRole(C1, address(0xBEEF), R2);

        bytes32[] memory rolesArray = new bytes32[](1);
        rolesArray[0] = R1;
        bytes32[] memory rolesArray2 = new bytes32[](2);
        rolesArray2[0] = R1;
        rolesArray2[1] = R2;

        acl.setRoleGroup(G1, rolesArray);
        acl.hasRoleInGroup(C1, address(0xBEEF), G1);

        // todo finish
    }

    // can have a role assigned, but not by a non-admin
    function testSetRoleByNonAdmin() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());

        // todo: save gas by starting assignment at 1 and avoid using 0.
        assertEq(acl.canAssign(C1, address(0xA11CE), address(0xBEEF), R1), acl.CANNOT_ASSIGN());

        vm.expectRevert("unauthorized");
        vm.prank(address(0xA11CE));
        acl.assignRole(C1, address(0xBEEF), R1);
    }

    // can have a role assigned, by an admin
    function testSetRoleByAdmin() public {
        assertEq(acl.hasRole(acl.systemContext(), address(0xCAFE), R1), acl.DOES_NOT_HAVE_ROLE());
    
        // check cannot assign

        acl.assignRole(C1, address(0xCAFE), keccak256("ROLE_APPROVED_USER"));

        // do checks
        acl.getRolesForUser(C1, address(0xCAFE));
        acl.getUsersForRole(C1, R1);
    }

    // by the context owner
    function testSetRoleByContextOwner() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());

        bytes32 callerContext = acl.generateContextFromAddress(address(0xD00D));

        assertEq(acl.hasRole(callerContext, address(0xBEEF), R1), acl.DOES_NOT_HAVE_ROLE());

        assertEq(acl.canAssign(callerContext, address(0xD00D), address(0xBEEF), R1), acl.CAN_ASSIGN_IS_OWN_CONTEXT());
    
        vm.prank(address(0xD00D));
        acl.assignRole(callerContext, address(0xBEEF), R1);

        assertEq(acl.hasRole(callerContext, address(0xBEEF), R1), acl.HAS_ROLE_CONTEXT());
        assertEq(acl.getRolesForUser(callerContext, address(0xBEEF))[0], R1);
        assertEq(acl.getUsersForRole(callerContext, R1)[0], address(0xBEEF));
    }

    // 227 multiple times
    function testSetRoleMultipleTimes() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());

        acl.assignRole(C1, address(0xBEEF), R1);
        acl.assignRole(C2, address(0xBEEF), R1);

        assertEq(acl.getRolesForUser(C1, address(0xBEEF))[0], R1);
        assertEq(acl.getUsersForRole(C1, R1)[0], address(0xBEEF));
    }

    // and another assigned
    function testSetRoleAnotherAssigned() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());

        acl.assignRole(C1, address(0xBEEF), R1);
        acl.assignRole(C1, address(0xBEEF), R2);

        assertEq(acl.getRolesForUser(C1, address(0xBEEF))[0], R1);
        assertEq(acl.getRolesForUser(C1, address(0xBEEF))[1], R2);
        
        assertEq(acl.getUsersForRole(C1, R1)[0], address(0xBEEF));
        assertEq(acl.getUsersForRole(C1, R2)[0], address(0xBEEF));
    }

    // by someone who can assign, but not if assignee is not approved
    function testSetRoleFromUnapproved() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());

        acl.unassignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());
        assertEq(acl.hasRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER()), acl.DOES_NOT_HAVE_ROLE());
 
        bytes32[] memory rolesArray = new bytes32[](1);
        rolesArray[0] = R2;
        acl.setRoleGroup(RG1, rolesArray);
        acl.addAssigner(R1, RG1);
        acl.assignRole(C1, address(0xCAFE), R2);

        assertEq(acl.hasRole(C1, address(0xBEEF), R1), acl.DOES_NOT_HAVE_ROLE());
        assertEq(acl.canAssign(C1, address(0xCAFE), address(0xBEEF), R1), acl.CANNOT_ASSIGN_USER_NOT_APPROVED());

        vm.expectRevert("unauthorized");
        vm.prank(address(0xCAFE));
        acl.assignRole(C1, address(0xBEEF), R1);
    }

    // by someone who can assign, but not if assignee is approved 
    function testSetRoleFromApproved() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());

        bytes32[] memory rolesArray = new bytes32[](1);
        rolesArray[0] = R2;
        acl.setRoleGroup(RG1, rolesArray);
        acl.addAssigner(R1, RG1);
        acl.assignRole(C1, address(0xCAFE), R2);

        assertEq(acl.hasRole(C1, address(0xBEEF), R1), acl.DOES_NOT_HAVE_ROLE());

        assertEq(acl.canAssign(C1, address(0xCAFE), address(0xBEEF), R1), acl.CAN_ASSIGN_HAS_ROLE());
        vm.prank(address(0xCAFE));
        acl.assignRole(C1, address(0xBEEF), R1);

        assertEq(acl.hasRole(C1, address(0xBEEF), R1), acl.HAS_ROLE_CONTEXT());
        assertEq(acl.getRolesForUser(C1, address(0xBEEF))[0], R1);
        assertEq(acl.getUsersForRole(C1, R1)[0], address(0xBEEF));
    }

    // and emits an event when successful
    function testSetRoleEvent() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());

        vm.expectEmit(true, true, true, true); // works
        emit RoleAssigned(C1, address(0xBEEF), R1);
        acl.assignRole(C1, address(0xBEEF), R1);
    }

    // and if assigned in the system context then it automatically applies to all other contexts
    function testSetRoleSystemContext() public {
        acl.assignRole(acl.systemContext(), address(0xBEEF), acl.ROLE_APPROVED_USER());
 
        assertEq(acl.hasRole(C1, address(0xBEEF), R1), acl.DOES_NOT_HAVE_ROLE());

        acl.assignRole(acl.systemContext(), address(0xBEEF), R1);

        assertEq(acl.hasRole(C1, address(0xBEEF), R1), acl.HAS_ROLE_SYSTEM_CONTEXT());
        assertEq(acl.hasRole(C2, address(0xBEEF), R1), acl.HAS_ROLE_SYSTEM_CONTEXT());
    }

    // cannot be assigned in the system context by a non-admin
    function testSetRoleCannotAssignInSystemContextByNonAdmin() public {
        alice.assignRole(systemContext, address(charlie), ROLE_APPROVED_USER);
        
        bytes32[] memory rolesArray = new bytes32[](1);
        rolesArray[0] = R2;
        alice.setRoleGroup(RG1, rolesArray);
        alice.addAssigner(R1, RG1);
        alice.assignRole(systemContext, address(alice), R2);
        alice.unassignRole(systemContext, address(alice), nayms.adminRole());
        
        // todo: not reverting when this is below. https://github.com/gakonst/foundry/issues/824
        vm.expectRevert("only admin can assign role in system context");
        alice.assignRole(systemContext, address(charlie), R1);
    }
    
    // 301 can have a role unassigned
    function testUnassignRole() public {
        alice.assignRole(systemContext, address(charlie), ROLE_APPROVED_USER);
        alice.assignRole(C1, address(charlie), R1);

        // but not by a non-admin
        vm.expectRevert(bytes("unauthorized"));         
        bob.unassignRole(C1, address(charlie), R1); 
    
        // by an admin
        bytes32[] memory rolesArray = new bytes32[](1);
        rolesArray[0] = R1;
        assertEq(alice.getRolesForUser(C1, address(charlie))[0], R1);
        
        alice.unassignRole(C1, address(charlie), R1);
        
        assertEq(alice.hasRole(C1, address(charlie), R1), DOES_NOT_HAVE_ROLE);
        
        // how to test for empty array?
        // delete rolesArray;
        // assertEq(alice.getRolesForUser(C1, address(charlie))[0], rolesArray[0]);
        
    }
    
    function testUnassignRoleCheckList() public {
        alice.assignRole(systemContext, address(charlie), ROLE_APPROVED_USER);
        alice.assignRole(C1, address(charlie), R1); 
        
        // and the internal list of assigned roles is updated efficiently
        alice.assignRole(C1, address(charlie), R2);
        alice.assignRole(C1, address(charlie), R3);
        alice.assignRole(C1, address(daisy), R3);
        alice.assignRole(C1, address(emma), R3);
        
        
        assertEq(alice.getRolesForUser(C1, address(charlie))[0], R1);
        assertEq(alice.getRolesForUser(C1, address(charlie))[1], R2);
        assertEq(alice.getRolesForUser(C1, address(charlie))[2], R3);
        
        assertEq(alice.getUsersForRole(C1, R1)[0], address(charlie));
        assertEq(alice.getUsersForRole(C1, R2)[0], address(charlie));
        assertEq(alice.getUsersForRole(C1, R3)[0], address(charlie));
        assertEq(alice.getUsersForRole(C1, R3)[1], address(daisy));
        assertEq(alice.getUsersForRole(C1, R3)[2], address(emma));
        
        // remove head of list
        alice.unassignRole(C1, address(charlie), R1);
        assertEq(alice.getRolesForUser(C1, address(charlie))[0], R3); 
        assertEq(alice.getRolesForUser(C1, address(charlie))[1], R2); 
        
        // todo check empty array
        
        assertEq(alice.getUsersForRole(C1, R2)[0], address(charlie));
        assertEq(alice.getUsersForRole(C1, R3)[0], address(charlie));
        assertEq(alice.getUsersForRole(C1, R3)[1], address(daisy));
        assertEq(alice.getUsersForRole(C1, R3)[2], address(emma));
        
        // remove end of list
        alice.unassignRole(C1, address(charlie), R2); 
        assertEq(alice.getRolesForUser(C1, address(charlie))[0], R3); 
        
        assertEq(alice.getUsersForRole(C1, R3)[0], address(charlie));
        assertEq(alice.getUsersForRole(C1, R3)[1], address(daisy));
        assertEq(alice.getUsersForRole(C1, R3)[2], address(emma)); 
        
        // remove same again, to ensure no error end of list
        alice.unassignRole(C1, address(charlie), R2); 
        assertEq(alice.getRolesForUser(C1, address(charlie))[0], R3);  
        
        // remove last item
        alice.unassignRole(C1, address(charlie), R3);  
        assertEq(alice.getUsersForRole(C1, R3)[1], address(daisy));
        assertEq(alice.getUsersForRole(C1, R3)[0], address(emma));  
        
        // remove final assignments one-by-one
        alice.unassignRole(C1, address(emma), R3);   
        assertEq(alice.getUsersForRole(C1, R3)[0], address(daisy));
        
        alice.unassignRole(C1, address(daisy), R3);  
    }
    
    // allows for an assigning rolegroup to be added and removed for a role
    function testAssigners() public {
        bytes32[] memory rolesArray = new bytes32[](3);
        rolesArray[0] = R1; 
        rolesArray[1] = R2; 
        rolesArray[2] = R3; 
        alice.setRoleGroup(RG1, rolesArray);
        alice.setRoleGroup(RG2, rolesArray);
        alice.setRoleGroup(RG3, rolesArray);
        
        alice.assignRole(C1, address(charlie), R2);
        alice.assignRole(systemContext, address(bob), ROLE_APPROVED_USER);
    }
}


// setRoleGroup - clears previous array, sets new array
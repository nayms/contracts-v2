// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./utils/DSTestPlusF.sol";
import "./utils/users/MockAccounts.sol";

import { IACLConstants } from "../../contracts/base/IACLConstants.sol";
import { ACL } from "../../contracts/ACL.sol";
import { Settings } from "../../contracts/Settings.sol";
import { ISettings } from "../../contracts/base/ISettings.sol";
import { ISettingsKeys } from "../../contracts/base/ISettingsKeys.sol";

contract SettingsTest is DSTestPlusF, IACLConstants, ISettingsKeys {
    ACL internal acl;
    Settings internal settings;

    address internal immutable account0 = address(this);

    event SettingChanged(address indexed context, bytes32 indexed key, address indexed caller, string keyType);

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));

        vm.label(address(acl), "ACL");
        vm.label(address(settings), "Settings");
        vm.label(address(this), "Account 0 - Test Contract");
        vm.label(address(0xBEEF), "Account 1");
        vm.label(address(0xCAFE), "Account 2");
        vm.label(address(0xD00D), "Account 3");
        vm.label(address(0xE), "Account 4");
    }

    // can return current block time
    function testGetTime() public {
        settings.getTime();
        vm.warp(50);
        settings.getTime();
    }

    // can have keys set, in the root context
    function testSetKeys() public {
        // but not just by anyone
        vm.startPrank(address(0xCAFE));
        vm.expectRevert("must be admin");
        settings.setAddress(address(settings), SETTING_MARKET, address(0xD00D));
        vm.expectRevert("must be admin");
        settings.setBool(address(settings), SETTING_MARKET, true);
        vm.expectRevert("must be admin");
        settings.setUint256(address(settings), SETTING_MARKET, 1);
        vm.expectRevert("must be admin");
        settings.setString(address(settings), SETTING_MARKET, "test");
        vm.stopPrank();

        // by admin
        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "address");
        settings.setAddress(address(settings), SETTING_MARKET, address(0xD00D));
        assertEq(settings.getAddress(address(settings), SETTING_MARKET), address(0xD00D));
        assertEq(settings.getRootAddress(SETTING_MARKET), address(0xD00D));

        address[] memory addys = new address[](1);
        addys[0] = address(0xD00D);
        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "addresses");
        settings.setAddresses(address(settings), SETTING_MARKET, addys);
        assertEq(settings.getAddresses(address(settings), SETTING_MARKET)[0], addys[0]);
        assertEq(settings.getRootAddresses(SETTING_MARKET)[0], addys[0]);

        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "bool");
        settings.setBool(address(settings), SETTING_MARKET, true);
        assertTrue(settings.getBool(address(settings), SETTING_MARKET));
        assertTrue(settings.getRootBool(SETTING_MARKET));

        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "uint256");
        settings.setUint256(address(settings), SETTING_MARKET, 123);
        assertEq(settings.getUint256(address(settings), SETTING_MARKET), 123);
        assertEq(settings.getRootUint256(SETTING_MARKET), 123);

        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "string");
        settings.setString(address(settings), SETTING_MARKET, "test");
        assertEq(settings.getString(address(settings), SETTING_MARKET), "test");
        assertEq(settings.getRootString(SETTING_MARKET), "test");
    }

    // in a non-root context
    function testSettingsNonRootContext() public {
        // but not if not the context owner
        vm.startPrank(address(0xCAFE));
        vm.expectRevert("must be context owner");
        settings.setAddress(address(0xD00D), SETTING_MARKET, address(0xD00D));
        vm.expectRevert("must be context owner");
        settings.setBool(address(0xD00D), SETTING_MARKET, true);
        vm.expectRevert("must be context owner");
        settings.setUint256(address(0xD00D), SETTING_MARKET, 1);
        vm.expectRevert("must be context owner");
        settings.setString(address(0xD00D), SETTING_MARKET, "test");
        vm.stopPrank();

        // by context owner
        settings.setAddress(account0, SETTING_MARKET, address(0xD00D));
        assertEq(settings.getAddress(account0, SETTING_MARKET), address(0xD00D));

        address[] memory addys = new address[](1);
        addys[0] = address(0xD00D);
        settings.setAddresses(account0, SETTING_MARKET, addys);
        assertEq(settings.getAddresses(account0, SETTING_MARKET)[0], addys[0]);

        settings.setBool(account0, SETTING_MARKET, true);
        assertTrue(settings.getBool(account0, SETTING_MARKET));

        settings.setUint256(account0, SETTING_MARKET, 123);
        assertEq(settings.getUint256(account0, SETTING_MARKET), 123);

        settings.setString(account0, SETTING_MARKET, "test");
        assertEq(settings.getString(account0, SETTING_MARKET), "test");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./utils/DSTestPlusF.sol";

import {IACLConstants} from "../../contracts/base/IACLConstants.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from "../../contracts/Settings.sol";
import {ISettings} from "../../contracts/base/ISettings.sol";
import {ISettingsKeys} from "../../contracts/base/ISettingsKeys.sol";

contract SettingsTest is DSTestPlusF, IACLConstants, ISettingsKeys {
    ACL internal acl;
    Settings internal settings;

    event SettingChanged(address indexed context, bytes32 indexed key, address indexed caller, string keyType);

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));

        vm.label(address(acl), "ACL");
        vm.label(address(settings), "Settings");
        vm.label(address(0xAAAA), "Account 0");
        vm.label(address(0xBEEF), "Account 1");
        vm.label(address(0xCAFE), "Account 2");
        vm.label(address(0xD00D), "Account 3");
        vm.label(address(0xE), "Account 4");
    }

    // can return current block time
    function testGetTime() public {
        ISettings(address(settings)).getTime();
        vm.warp(50);
        ISettings(address(settings)).getTime();
    }

    // can have keys set, in the root context
    function testSetKeys() public {
        // but not just by anyone
        vm.startPrank(address(0xCAFE));
        vm.expectRevert("must be admin");
        ISettings(address(settings)).setAddress(address(settings), SETTING_MARKET, address(0xD00D));
        vm.expectRevert("must be admin");
        ISettings(address(settings)).setBool(address(settings), SETTING_MARKET, true);
        vm.expectRevert("must be admin");
        ISettings(address(settings)).setUint256(address(settings), SETTING_MARKET, 1);
        vm.expectRevert("must be admin");
        ISettings(address(settings)).setString(address(settings), SETTING_MARKET, "test");
        vm.stopPrank();

        // by admin
        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "address");
        ISettings(address(settings)).setAddress(address(settings), SETTING_MARKET, address(0xD00D));
        assertEq(ISettings(address(settings)).getAddress(address(settings), SETTING_MARKET), address(0xD00D));
        assertEq(ISettings(address(settings)).getRootAddress(SETTING_MARKET), address(0xD00D));

        address[] memory addys = new address[](1);
        addys[0] = address(0xD00D);
        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "addresses");
        ISettings(address(settings)).setAddresses(address(settings), SETTING_MARKET, addys);
        assertEq(ISettings(address(settings)).getAddresses(address(settings), SETTING_MARKET)[0], addys[0]);
        assertEq(ISettings(address(settings)).getRootAddresses(SETTING_MARKET)[0], addys[0]);

        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "bool");
        ISettings(address(settings)).setBool(address(settings), SETTING_MARKET, true);
        assertTrue(ISettings(address(settings)).getBool(address(settings), SETTING_MARKET));
        assertTrue(ISettings(address(settings)).getRootBool(SETTING_MARKET));

        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "uint256");
        ISettings(address(settings)).setUint256(address(settings), SETTING_MARKET, 123);
        assertEq(ISettings(address(settings)).getUint256(address(settings), SETTING_MARKET), 123);
        assertEq(ISettings(address(settings)).getRootUint256(SETTING_MARKET), 123);

        vm.expectEmit(true, true, true, true);
        emit SettingChanged(address(settings), SETTING_MARKET, address(this), "string");
        ISettings(address(settings)).setString(address(settings), SETTING_MARKET, "test");
        assertEq(ISettings(address(settings)).getString(address(settings), SETTING_MARKET), "test");
        assertEq(ISettings(address(settings)).getRootString(SETTING_MARKET), "test");
    }

    // in a non-root context
    function testSettingsNonRootContext() public {
        // but not if not the context owner
        vm.startPrank(address(0xCAFE));
        vm.expectRevert("must be context owner");
        ISettings(address(settings)).setAddress(address(0xD00D), SETTING_MARKET, address(0xD00D));
        vm.expectRevert("must be context owner");
        ISettings(address(settings)).setBool(address(0xD00D), SETTING_MARKET, true);
        vm.expectRevert("must be context owner");
        ISettings(address(settings)).setUint256(address(0xD00D), SETTING_MARKET, 1);
        vm.expectRevert("must be context owner");
        ISettings(address(settings)).setString(address(0xD00D), SETTING_MARKET, "test");
        vm.stopPrank();

        // by context owner
        ISettings(address(settings)).setAddress(address(0xAAAA), SETTING_MARKET, address(0xD00D));
        assertEq(ISettings(address(settings)).getAddress(address(0xAAAA), SETTING_MARKET), address(0xD00D));

        address[] memory addys = new address[](1);
        addys[0] = address(0xD00D);
        ISettings(address(settings)).setAddresses(address(0xAAAA), SETTING_MARKET, addys);
        assertEq(ISettings(address(settings)).getAddresses(address(0xAAAA), SETTING_MARKET)[0], addys[0]);

        ISettings(address(settings)).setBool(address(0xAAAA), SETTING_MARKET, true);
        assertTrue(ISettings(address(settings)).getBool(address(0xAAAA), SETTING_MARKET));

        ISettings(address(settings)).setUint256(address(0xAAAA), SETTING_MARKET, 123);
        assertEq(ISettings(address(settings)).getUint256(address(0xAAAA), SETTING_MARKET), 123);

        ISettings(address(settings)).setString(address(0xAAAA), SETTING_MARKET, "test");
        assertEq(ISettings(address(settings)).getString(address(0xAAAA), SETTING_MARKET), "test");
    }
}

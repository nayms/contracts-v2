// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./utils/DSTestPlusF.sol";

import { IACLConstants } from "../../contracts/base/IACLConstants.sol";
import { ISettingsKeys } from "../../contracts/base/ISettingsKeys.sol";
import { AccessControl } from "../../contracts/base/AccessControl.sol";
import { ACL } from "../../contracts/ACL.sol";
import { Settings } from "../../contracts/Settings.sol";

import { ISettings } from "../../contracts/base/ISettings.sol";

import { FeeBank } from "../../contracts/FeeBank.sol";
import { FeeBankCoreFacet } from "../../contracts/FeeBankCoreFacet.sol";
import { IFeeBank } from "../../contracts/base/IFeeBank.sol";
import { IFeeBankCoreFacet } from "../../contracts/base/IFeeBankCoreFacet.sol";

import { DummyToken } from "../../contracts/DummyToken.sol";

contract FeeBankTest is DSTestPlusF, IACLConstants, ISettingsKeys {
    ACL internal acl;
    Settings internal settings;

    DummyToken internal token1;
    DummyToken internal token2;

    FeeBank internal feeBank;
    FeeBankCoreFacet internal feeBankCoreFacet;

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));

        token1 = new DummyToken("Token 1", "TOK1", 18, 0, false);
        token2 = new DummyToken("Token 2", "TOK2", 18, 0, false);

        // note: with the current setup, facets must be deployed first and call setAddress(es) on settings BEFORE deploying the respective diamond
        // also, seems like we must use setAddresses when cutting in even just a single facet
        feeBankCoreFacet = new FeeBankCoreFacet(address(settings));
        address[] memory addys = new address[](1);
        addys[0] = address(feeBankCoreFacet);
        settings.setAddresses(address(settings), SETTING_FEEBANK_IMPL, addys); // fee bank facets
        // settings.setAddress(address(settings), SETTING_FEEBANK_IMPL, address(feeBankCoreFacet)); // fee bank facet
        // note: deploy diamond AFTER calling setAddress
        feeBank = new FeeBank(address(settings));

        vm.label(address(acl), "ACL");
        vm.label(address(settings), "Settings");

        vm.label(address(feeBank), "Fee Bank");
        vm.label(address(feeBankCoreFacet), "Fee Bank Core Facet");

        settings.setAddress(address(settings), SETTING_FEEBANK, address(feeBank)); // fee bank
    }

    function testFeeBankBalances() public {
        assertEq(IFeeBankCoreFacet(address(feeBank)).getBalance(address(token1)), 0);
        assertEq(IFeeBankCoreFacet(address(feeBank)).getBalance(address(token2)), 0);

        token1.deposit{ value: 100 }();
        token1.transfer(address(feeBank), 23);

        assertEq(IFeeBankCoreFacet(address(feeBank)).getBalance(address(token1)), 23);
        assertEq(IFeeBankCoreFacet(address(feeBank)).getBalance(address(token2)), 0);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./utils/DSTestPlusF.sol";

import {IACLConstants} from "../../contracts/base/IACLConstants.sol";
import {ISettingsKeys} from "../../contracts/base/ISettingsKeys.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from "../../contracts/Settings.sol";
import {AccessControl} from "../../contracts/base/AccessControl.sol";
import {ISettings} from "../../contracts/base/ISettings.sol";

import {IMarketFeeSchedules} from "../../contracts/base/IMarketFeeSchedules.sol";
import {IMarket} from "../../contracts/base/IMarket.sol";
import {Market} from "../../contracts/Market.sol";
import {MarketCoreFacet} from "../../contracts/MarketCoreFacet.sol";
import {MarketDataFacet} from "../../contracts/MarketDataFacet.sol";

import {EntityDeployer} from "../../contracts/EntityDeployer.sol";

import {FeeBankCoreFacet} from "../../contracts/FeeBankCoreFacet.sol";

import {FeeBank} from "../../contracts/FeeBank.sol";

import {PolicyCoreFacet} from "../../contracts/PolicyCoreFacet.sol";
import {PolicyClaimsFacet} from "../../contracts/PolicyClaimsFacet.sol";
import {PolicyCommissionsFacet} from "../../contracts/PolicyCommissionsFacet.sol";
import {PolicyPremiumsFacet} from "../../contracts/PolicyPremiumsFacet.sol";
import {PolicyTrancheTokensFacet} from "../../contracts/PolicyTrancheTokensFacet.sol";
import {PolicyApprovalsFacet} from "../../contracts/PolicyApprovalsFacet.sol";

import {PolicyDelegate} from "../../contracts/PolicyDelegate.sol";

import {EntityCoreFacet} from "../../contracts/EntityCoreFacet.sol";
import {EntityFundingFacet} from "../../contracts/EntityFundingFacet.sol";
import {EntityTokensFacet} from "../../contracts/EntityTokensFacet.sol";
import {EntityDividendsFacet} from "../../contracts/EntityDividendsFacet.sol";
import {EntityTreasuryFacet} from "../../contracts/EntityTreasuryFacet.sol";
import {EntityTreasuryBridgeFacet} from "../../contracts/EntityTreasuryBridgeFacet.sol";
import {EntitySimplePolicyCoreFacet} from "../../contracts/EntitySimplePolicyCoreFacet.sol";
import {EntitySimplePolicyDataFacet} from "../../contracts/EntitySimplePolicyDataFacet.sol";

import {IEntity} from "../../contracts/base/IEntity.sol";
import {EntityDelegate} from "../../contracts/EntityDelegate.sol";

import {DummyEntityFacet} from "../../contracts/test/DummyEntityFacet.sol";

import {DummyToken} from "../../contracts/DummyToken.sol";

import {CommonUpgradeFacet} from "../../contracts/CommonUpgradeFacet.sol";

import {FreezeUpgradesFacet} from "../../contracts/test/FreezeUpgradesFacet.sol";

import {IDiamondProxy} from "../../contracts/base/IDiamondProxy.sol";

interface IProxy {
    function getDelegateAddress() external view returns (address);
}

/// @notice test entity

contract Entity2Test is DSTestPlusF, IACLConstants, ISettingsKeys, IMarketFeeSchedules {
    ACL internal acl;
    Settings internal settings;
    bytes32 internal systemContext;

    MarketCoreFacet internal marketCoreFacet;
    MarketDataFacet internal marketDataFacet;
    Market internal market;

    EntityDeployer internal entityDeployer;

    FeeBankCoreFacet internal feeBankCoreFacet;
    FeeBank internal feeBank;

    PolicyCoreFacet internal policyCoreFacet;
    PolicyClaimsFacet internal policyClaimsFacet;
    PolicyCommissionsFacet internal policyCommissionsFacet;
    PolicyPremiumsFacet internal policyPremiumsFacet;
    PolicyTrancheTokensFacet internal policyTrancheTokensFacet;
    PolicyApprovalsFacet internal policyApprovalsFacet;
    PolicyDelegate internal policyDelegate;

    EntityCoreFacet internal entityCoreFacet;
    EntityFundingFacet internal entityFundingFacet;
    EntityTokensFacet internal entityTokensFacet;
    EntityDividendsFacet internal entityDividendsFacet;
    EntityTreasuryFacet internal entityTreasuryFacet;
    EntityTreasuryBridgeFacet internal entityTreasuryBridgeFacet;
    EntitySimplePolicyCoreFacet internal entitySimplePolicyCoreFacet;
    EntitySimplePolicyDataFacet internal entitySimplePolicyDataFacet;
    EntityDelegate internal entityDelegate;

    CommonUpgradeFacet internal commonUpgradeFacet;

    address internal entityAdmin;
    bytes32 internal entityContext;
    address internal entity;

    DummyToken internal wethFalse;
    DummyToken internal wethTrue;

    event EntityDeposit(address indexed caller, address indexed unit, uint256 indexed amount);

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        systemContext = acl.systemContext();

        commonUpgradeFacet = new CommonUpgradeFacet(address(settings));

        wethFalse = new DummyToken("Wrapped ETH", "WETH", 18, 0, false);
        wethTrue = new DummyToken("Wrapped ETH True", "WETH-TRUE", 18, 0, true);

        // setup role groups
        bytes32[] memory rg1 = new bytes32[](1);
        rg1[0] = ROLE_APPROVED_USER;
        acl.setRoleGroup(ROLEGROUP_APPROVED_USERS, rg1);
        bytes32[] memory rg2 = new bytes32[](2);
        rg2[0] = ROLE_UNDERWRITER;
        rg2[1] = ROLE_CAPITAL_PROVIDER;
        acl.setRoleGroup(ROLEGROUP_CAPITAL_PROVIDERS, rg2);
        bytes32[] memory rg3 = new bytes32[](1);
        rg3[0] = ROLE_UNDERWRITER;
        acl.setRoleGroup(ROLEGROUP_UNDERWRITERS, rg3);
        bytes32[] memory rg4 = new bytes32[](1);
        rg4[0] = ROLE_BROKER;
        acl.setRoleGroup(ROLEGROUP_BROKERS, rg4);
        bytes32[] memory rg5 = new bytes32[](1);
        rg5[0] = ROLE_INSURED_PARTY;
        acl.setRoleGroup(ROLEGROUP_INSURED_PARTYS, rg5);
        bytes32[] memory rg6 = new bytes32[](1);
        rg6[0] = ROLE_CLAIMS_ADMIN;
        acl.setRoleGroup(ROLEGROUP_CLAIMS_ADMINS, rg6);
        bytes32[] memory rg7 = new bytes32[](1);
        rg7[0] = ROLE_ENTITY_ADMIN;
        acl.setRoleGroup(ROLEGROUP_ENTITY_ADMINS, rg7);
        bytes32[] memory rg8 = new bytes32[](2);
        rg8[0] = ROLE_ENTITY_ADMIN;
        rg8[1] = ROLE_ENTITY_MANAGER;
        acl.setRoleGroup(ROLEGROUP_ENTITY_MANAGERS, rg8);
        bytes32[] memory rg9 = new bytes32[](3);
        rg9[0] = ROLE_ENTITY_ADMIN;
        rg9[1] = ROLE_ENTITY_MANAGER;
        rg9[2] = ROLE_ENTITY_REP;
        acl.setRoleGroup(ROLEGROUP_ENTITY_REPS, rg9);
        bytes32[] memory rg10 = new bytes32[](1);
        rg10[0] = ROLE_POLICY_OWNER;
        acl.setRoleGroup(ROLEGROUP_POLICY_OWNERS, rg10);
        bytes32[] memory rg11 = new bytes32[](1);
        rg11[0] = ROLE_SYSTEM_ADMIN;
        acl.setRoleGroup(ROLEGROUP_SYSTEM_ADMINS, rg11);
        bytes32[] memory rg12 = new bytes32[](1);
        rg12[0] = ROLE_SYSTEM_MANAGER;
        acl.setRoleGroup(ROLEGROUP_SYSTEM_MANAGERS, rg12);
        bytes32[] memory rg13 = new bytes32[](1);
        rg13[0] = ROLE_ENTITY_REP;
        acl.setRoleGroup(ROLEGROUP_TRADERS, rg13);

        // setup assigners
        acl.addAssigner(ROLE_APPROVED_USER, ROLEGROUP_SYSTEM_MANAGERS);
        acl.addAssigner(ROLE_UNDERWRITER, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_CAPITAL_PROVIDER, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_BROKER, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_INSURED_PARTY, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_ENTITY_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        acl.addAssigner(ROLE_ENTITY_MANAGER, ROLEGROUP_ENTITY_ADMINS);
        acl.addAssigner(ROLE_ENTITY_REP, ROLEGROUP_ENTITY_MANAGERS);
        acl.addAssigner(ROLE_ENTITY_REP, ROLEGROUP_SYSTEM_MANAGERS);
        acl.addAssigner(ROLE_SYSTEM_MANAGER, ROLEGROUP_SYSTEM_ADMINS);

        marketCoreFacet = new MarketCoreFacet(address(settings));
        marketDataFacet = new MarketDataFacet(address(settings));
        address[] memory marketFacetAddys = new address[](2);
        marketFacetAddys[0] = address(marketCoreFacet);
        marketFacetAddys[1] = address(marketDataFacet);
        // facets use the key with suffix _IMPL
        settings.setAddresses(address(settings), SETTING_MARKET_IMPL, marketFacetAddys);

        market = new Market(address(settings));
        vm.label(address(market), "Market Proxy Diamond");
        // market proxy diamond
        settings.setAddress(address(settings), SETTING_MARKET, address(market));

        entityDeployer = new EntityDeployer(address(settings));
        vm.label(address(entityDeployer), "Entity Deployer");
        settings.setAddress(address(settings), SETTING_ENTITY_DEPLOYER, address(entityDeployer));

        feeBankCoreFacet = new FeeBankCoreFacet(address(settings));
        address[] memory feeBankFacetAddys = new address[](1);
        feeBankFacetAddys[0] = address(feeBankCoreFacet);
        settings.setAddresses(address(settings), SETTING_FEEBANK_IMPL, feeBankFacetAddys);

        feeBank = new FeeBank(address(settings));
        settings.setAddress(address(settings), SETTING_FEEBANK, address(feeBank));

        policyCoreFacet = new PolicyCoreFacet(address(settings));
        policyClaimsFacet = new PolicyClaimsFacet(address(settings));
        policyCommissionsFacet = new PolicyCommissionsFacet(address(settings));
        policyPremiumsFacet = new PolicyPremiumsFacet(address(settings));
        policyTrancheTokensFacet = new PolicyTrancheTokensFacet(address(settings));
        policyApprovalsFacet = new PolicyApprovalsFacet(address(settings));
        address[] memory policyFacetAddys = new address[](6);
        policyFacetAddys[0] = address(policyCoreFacet);
        policyFacetAddys[1] = address(policyClaimsFacet);
        policyFacetAddys[2] = address(policyCommissionsFacet);
        policyFacetAddys[3] = address(policyPremiumsFacet);
        policyFacetAddys[4] = address(policyTrancheTokensFacet);
        policyFacetAddys[5] = address(policyApprovalsFacet);
        settings.setAddresses(address(settings), SETTING_POLICY_IMPL, policyFacetAddys);

        policyDelegate = new PolicyDelegate(address(settings));
        settings.setAddress(address(settings), SETTING_POLICY_DELEGATE, address(policyDelegate));

        entityCoreFacet = new EntityCoreFacet(address(settings));
        entityFundingFacet = new EntityFundingFacet(address(settings));
        entityTokensFacet = new EntityTokensFacet(address(settings));
        entityDividendsFacet = new EntityDividendsFacet(address(settings));
        entityTreasuryFacet = new EntityTreasuryFacet(address(settings));
        entityTreasuryBridgeFacet = new EntityTreasuryBridgeFacet(address(settings));
        entitySimplePolicyCoreFacet = new EntitySimplePolicyCoreFacet(address(settings));
        entitySimplePolicyDataFacet = new EntitySimplePolicyDataFacet(address(settings));

        address[] memory entityFacetAddys = new address[](9);
        entityFacetAddys[0] = address(entityCoreFacet);
        entityFacetAddys[1] = address(entityFundingFacet);
        entityFacetAddys[2] = address(entityTokensFacet);
        entityFacetAddys[3] = address(entityDividendsFacet);
        entityFacetAddys[4] = address(entityTreasuryFacet);
        entityFacetAddys[5] = address(entityTreasuryBridgeFacet);
        entityFacetAddys[6] = address(entitySimplePolicyCoreFacet);
        entityFacetAddys[7] = address(entitySimplePolicyDataFacet);
        entityFacetAddys[8] = address(commonUpgradeFacet);
        settings.setAddresses(address(settings), SETTING_ENTITY_IMPL, entityFacetAddys);

        entityDelegate = new EntityDelegate(address(settings));
        vm.label(address(entityDelegate), "Entity Delegate");
        settings.setAddress(address(settings), SETTING_ENTITY_DELEGATE, address(entityDelegate));

        acl.assignRole(systemContext, address(this), ROLE_SYSTEM_MANAGER);
        acl.assignRole(systemContext, address(this), ROLE_ENTITY_MANAGER);

        entityAdmin = address(this);
        entityDeployer.deploy(entityAdmin, entityContext);

        entity = entityDeployer.getChild(1);

        vm.label(address(wethFalse), "WETH False");
        vm.label(address(wethTrue), "WETH True");
        vm.label(address(0xAAAA), "Account 0");
        vm.label(address(0xBEEF), "Account 1");
        vm.label(address(0xCAFE), "Account 2");
        vm.label(address(0xD00D), "Account 3");
        vm.label(address(0x4EEE), "Account 4");
        vm.label(address(0xFEED), "Account 5");
        vm.label(address(0x6FFF), "Account 6");
        vm.label(address(0x7AAA), "Account 7");
        vm.label(address(0x8BBB), "Account 8");
        vm.label(address(0x9CCC), "Account 9");
    }

    struct VersionInfo {
        string num;
        uint256 date;
        string hashOut;
    }

    function testCreateEntity() public {
        // entityAdmin = address(this);
        // entityDeployer.deploy(entityAdmin, entityContext);

        // address entity = entityDeployer.getChild(1);
        // address entity = 0x7860e8719387c0FfBAFBfFE3bcD111F665a63EE4;

        // address parentAddy = IEntity(address(entity)).getParent();
        // address parentAddy = IEntity(address(addys[0])).getParent();
        // console.log(parentAddy);

        // assertEq(address(parentAddy), address(entityDeployer));

        settings.getRootAddresses(SETTING_ENTITY_IMPL);
        DummyEntityFacet dummyEntityTestFacet = new DummyEntityFacet();

        address delegateAddress = IProxy(address(entity)).getDelegateAddress();
        console.log("Delegate Address", delegateAddress);

        address[] memory upgradeAddys = new address[](1);
        // upgradeAddys[0] = address(dummyEntityTestFacet);
        upgradeAddys[0] = address(entityCoreFacet);
        vm.expectRevert("Adding functions failed.");
        IEntity(delegateAddress).upgrade(upgradeAddys);
        // IEntity(entity).upgrade(upgradeAddys);

        VersionInfo memory vinfo;
        (vinfo.num, vinfo.date, vinfo.hashOut) = IEntity(entity).getVersionInfo();
    }

    function testUpgradeEntity() public {
        // entityAdmin = address(this);
        // entityDeployer.deploy(entityAdmin, entityContext);

        // address entity = entityDeployer.getChild(1);
        address delegateAddress = IProxy(address(entity)).getDelegateAddress();
        DummyEntityFacet dummyEntityTestFacet = new DummyEntityFacet();
        address[] memory upgradeAddys = new address[](1);
        upgradeAddys[0] = address(dummyEntityTestFacet);
        IEntity(delegateAddress).upgrade(upgradeAddys);

        // no point testing this.
        uint256 bal = IEntity(entity).getBalance(address(this));

        console.log("bal:", bal);
    }

    function testFreezeUpgrades() public {
        address delegateAddress = IProxy(address(entity)).getDelegateAddress();
        DummyEntityFacet dummyEntityTestFacet = new DummyEntityFacet();
        FreezeUpgradesFacet freezeUpgradesFacet = new FreezeUpgradesFacet();
        address[] memory upgradeAddys = new address[](1);
        upgradeAddys[0] = address(freezeUpgradesFacet);
        IEntity(delegateAddress).upgrade(upgradeAddys);

        upgradeAddys[0] = address(dummyEntityTestFacet);
        vm.expectRevert("frozen");
        IEntity(delegateAddress).upgrade(upgradeAddys);
    }

    function testRejectRegisterFacets() public {
        // entityAdmin = address(this);
        // entityDeployer.deploy(entityAdmin, entityContext);

        // address entity = entityDeployer.getChild(1);
        FreezeUpgradesFacet freezeUpgradesFacet = new FreezeUpgradesFacet();
        address[] memory upgradeAddys = new address[](1);
        upgradeAddys[0] = address(freezeUpgradesFacet);
        vm.expectRevert("external caller not allowed");
        IDiamondProxy(entity).registerFacets(upgradeAddys);

        // address delegateAddress = IProxy(address(entity)).getDelegateAddress();
        // DummyEntityFacet dummyEntityTestFacet = new DummyEntityFacet();
        // FreezeUpgradesFacet freezeUpgradesFacet = new FreezeUpgradesFacet();
        // address[] memory upgradeAddys = new address[](1);
        // upgradeAddys[0] = address(freezeUpgradesFacet);
        // IEntity(delegateAddress).upgrade(upgradeAddys);
    }

    function testEntityDeposit() public {
        wethFalse.deposit{value: 10}();
        wethFalse.approve(address(entity), 10);
        vm.expectRevert("DummyToken: transfer amount exceeds allowance");
        IEntity(address(entity)).deposit(address(wethFalse), 11);

        vm.expectEmit(true, true, true, true);
        emit EntityDeposit(address(this), address(wethFalse), 10);
        IEntity(address(entity)).deposit(address(wethFalse), 10);

        assertEq(wethFalse.balanceOf(address(entity)), 10);
        assertEq(IEntity(address(entity)).getBalance(address(wethFalse)), 10);

        vm.expectRevert("must be entity admin");
        vm.prank(address(0xBEEF));
        IEntity(address(entity)).withdraw(address(wethFalse), 10);

        IEntity(address(entity)).withdraw(address(wethFalse), 10);
        assertEq(wethFalse.balanceOf(address(this)), 10);

        wethFalse.deposit{value: 200}();

        wethFalse.transfer(address(entity), 100);

        wethFalse.approve(address(entity), 100);
        IEntity(address(entity)).deposit(address(wethFalse), 10);
        assertEq(wethFalse.balanceOf(address(entity)), 110);
        assertEq(IEntity(address(entity)).getBalance(address(wethFalse)), 10);

        vm.expectRevert("exceeds entity balance");
        IEntity(address(entity)).withdraw(address(wethFalse), 11);

        IEntity(address(entity)).withdraw(address(wethFalse), 10);

        assertEq(IEntity(address(entity)).getBalance(address(wethFalse)), 0);

        vm.expectRevert("exceeds entity balance");
        IEntity(address(entity)).withdraw(address(wethFalse), 11);
    }

    function testEntityTrade() public {
        wethFalse.deposit{value: 10}();
        wethFalse.approve(address(entity), 10);
        IEntity(address(entity)).deposit(address(wethFalse), 10);

        vm.expectRevert("must be trader");
        IEntity(address(entity)).trade(address(wethFalse), 1, address(wethTrue), 1);

        acl.assignRole(IEntity(address(entity)).aclContext(), address(0xD00D), ROLE_ENTITY_REP);

        vm.prank(address(0xD00D));
        IEntity(address(entity)).trade(address(wethFalse), 1, address(wethTrue), 1);

        vm.deal(address(0xFEED), 1 ether);
        vm.startPrank(address(0xFEED));
        wethTrue.deposit{value: 1}();

        wethTrue.approve(address(market), 1);
        uint256 offerId = IMarket(address(market)).getLastOfferId();

        IMarket(address(market)).buy(offerId, 1);

        assertEq(wethFalse.balanceOf(address(0xFEED)), 1);

        wethFalse.deposit{value: 200}();

        wethFalse.transfer(address(entity), 101);
        vm.stopPrank();
        assertEq(wethFalse.balanceOf(address(entity)), 110);

        vm.startPrank(address(0xD00D));
        vm.expectRevert("exceeds entity balance");
        IEntity(address(entity)).trade(address(wethFalse), 11, address(wethTrue), 1);

        IEntity(address(entity)).trade(address(wethFalse), 10, address(wethTrue), 1);
    }

    function testEntitySellAtBestPrice() public {
        wethFalse.deposit{value: 10}();
        wethFalse.approve(address(entity), 10);
        IEntity(address(entity)).deposit(address(wethFalse), 10);

        vm.expectRevert("must be trader");
        IEntity(address(entity)).sellAtBestPrice(address(wethFalse), 1, address(wethTrue));

        acl.assignRole(IEntity(address(entity)).aclContext(), address(0xD00D), ROLE_ENTITY_REP);

        vm.deal(address(0x7AAA), 1 ether);
        vm.startPrank(address(0x7AAA));
        wethTrue.deposit{value: 100}();
        wethTrue.approve(address(market), 100);
        IMarket(address(market)).executeLimitOffer(address(wethTrue), 100, address(wethFalse), 3, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.deal(address(0x8BBB), 1 ether);
        vm.startPrank(address(0x8BBB));
        wethTrue.deposit{value: 50}();
        wethTrue.approve(address(market), 50);
        IMarket(address(market)).executeLimitOffer(address(wethTrue), 50, address(wethFalse), 5, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        uint256 offerId = IMarket(address(market)).getBestOfferId(address(wethTrue), address(wethFalse));

        vm.prank(address(0xD00D));
        IEntity(address(entity)).sellAtBestPrice(address(wethFalse), 5, address(wethTrue));

        assertEq(wethTrue.balanceOf(address(entity)), 120);
        assertEq(wethFalse.balanceOf(address(0x7AAA)), 3);
        assertEq(wethFalse.balanceOf(address(0x8BBB)), 2);

        assertEq(wethFalse.balanceOf(address(entity)), 5);

        wethFalse.deposit{value: 200}();
        wethFalse.transfer(address(entity), 100);

        assertEq(wethFalse.balanceOf(address(entity)), 105);

        vm.startPrank(address(0x8BBB));
        wethTrue.deposit{value: 50}();
        wethTrue.approve(address(market), 50);
        IMarket(address(market)).executeLimitOffer(address(wethTrue), 50, address(wethFalse), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(address(0xD00D));
        vm.expectRevert("exceeds entity balance");
        IEntity(address(entity)).sellAtBestPrice(address(wethFalse), 11, address(wethTrue));

        IEntity(address(entity)).sellAtBestPrice(address(wethFalse), 10, address(wethTrue));
    }

    struct TokenInfo {
        address tokenAddress;
        uint256 currentTokenSaleOfferId;
    }

    function testEntityTokens() public {
        address systemManager = address(0xBEEF);
        address entityManager = address(0xCAFE);
        acl.assignRole(IEntity(address(entity)).aclContext(), systemManager, ROLE_ENTITY_MANAGER);
        acl.assignRole(IEntity(address(entity)).aclContext(), entityManager, ROLE_SYSTEM_MANAGER);

        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = IEntity(address(entity)).getTokenInfo();
        assertEq(tokenInfo.tokenAddress, address(0));
        assertEq(tokenInfo.currentTokenSaleOfferId, 0);

        vm.expectRevert("must be system mgr");
        vm.prank(systemManager);
        IEntity(entity).startTokenSale(500, address(wethFalse), 1000);

        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = IEntity(address(entity)).getTokenInfo();
    }
}

// 1. ACL
// 2. Settings
// - Market?
// 3. EntityDeployer
// 4. FeeBank
// Platform Token(s)
// Policy Delegate
// Entity Delegate
// entity checks with entity delegate to call methods

// FreezeUpgradesFacet perma freezes upgrades
// Entity has to send eth, then deposit the vault token. This can be done in one method call

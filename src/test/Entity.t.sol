// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./utils/DSTestPlusF.sol";
import "./utils/users/MockAccounts.sol";

import { IACLConstants } from "../../contracts/base/IACLConstants.sol";
import { ISettingsKeys } from "../../contracts/base/ISettingsKeys.sol";
import { ACL } from "../../contracts/ACL.sol";
import { Settings } from "../../contracts/Settings.sol";
import { AccessControl } from "../../contracts/base/AccessControl.sol";
import { ISettings } from "../../contracts/base/ISettings.sol";

import { IMarketFeeSchedules } from "../../contracts/base/IMarketFeeSchedules.sol";
import { IMarketDataFacet } from "../../contracts/base/IMarketDataFacet.sol";
import { IMarket } from "../../contracts/base/IMarket.sol";
import { Market } from "../../contracts/Market.sol";
import { MarketCoreFacet } from "../../contracts/MarketCoreFacet.sol";
import { MarketDataFacet } from "../../contracts/MarketDataFacet.sol";

import { EntityDeployer } from "../../contracts/EntityDeployer.sol";

import { FeeBankCoreFacet } from "../../contracts/FeeBankCoreFacet.sol";

import { FeeBank } from "../../contracts/FeeBank.sol";

import { IPolicyStates } from "../../contracts/base/IPolicyStates.sol";
import { IPolicyTypes } from "../../contracts/base/IPolicyTypes.sol";
import { IPolicy } from "../../contracts/base/IPolicy.sol";
import { ISimplePolicy2 } from "../../contracts/base/ISimplePolicy2.sol";
import { PolicyCoreFacet } from "../../contracts/PolicyCoreFacet.sol";
import { PolicyClaimsFacet } from "../../contracts/PolicyClaimsFacet.sol";
import { PolicyCommissionsFacet } from "../../contracts/PolicyCommissionsFacet.sol";
import { PolicyPremiumsFacet } from "../../contracts/PolicyPremiumsFacet.sol";
import { PolicyTrancheTokensFacet } from "../../contracts/PolicyTrancheTokensFacet.sol";
import { PolicyApprovalsFacet } from "../../contracts/PolicyApprovalsFacet.sol";

import { PolicyDelegate } from "../../contracts/PolicyDelegate.sol";

import { EntityCoreFacet } from "../../contracts/EntityCoreFacet.sol";
import { EntityFundingFacet } from "../../contracts/EntityFundingFacet.sol";
import { EntityTokensFacet } from "../../contracts/EntityTokensFacet.sol";
import { EntityDividendsFacet } from "../../contracts/EntityDividendsFacet.sol";
import { EntityTreasuryFacet } from "../../contracts/EntityTreasuryFacet.sol";
import { EntityTreasuryBridgeFacet } from "../../contracts/EntityTreasuryBridgeFacet.sol";
import { EntitySimplePolicyCoreFacet } from "../../contracts/EntitySimplePolicyCoreFacet.sol";
import { EntitySimplePolicyDataFacet } from "../../contracts/EntitySimplePolicyDataFacet.sol";

import { IEntity } from "../../contracts/base/IEntity.sol";
import { EntityDelegate } from "../../contracts/EntityDelegate.sol";
import { Entity } from "../../contracts/Entity.sol";

import { DummyEntityFacet } from "../../contracts/test/DummyEntityFacet.sol";

import { DummyToken } from "../../contracts/DummyToken.sol";

import { CommonUpgradeFacet } from "../../contracts/CommonUpgradeFacet.sol";

import { FreezeUpgradesFacet } from "../../contracts/test/FreezeUpgradesFacet.sol";

import { IDiamondProxy } from "../../contracts/base/IDiamondProxy.sol";
import { Strings } from "../../contracts/base/Strings.sol";
import { Address } from "../../contracts/base/Address.sol";

interface IProxy {
    function getDelegateAddress() external view returns (address);
}

/// @notice test entityAddress

contract EntityTest is DSTestPlusF, MockAccounts, IACLConstants, ISettingsKeys, IMarketFeeSchedules, IPolicyStates, IPolicyTypes {
    using Address for address;
    using Strings for string;

    ACL internal acl;
    Settings internal settings;
    bytes32 internal systemContext;

    MarketCoreFacet internal marketCoreFacet;
    MarketDataFacet internal marketDataFacet;
    Market internal marketProxy;

    IMarket internal market;

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
    address internal entityAddress;

    DummyToken internal weth;
    DummyToken internal wethTrue;

    IEntity internal entity;

    address internal immutable account0 = address(this);

    address internal constant systemManager = account1;
    address internal constant entityManager = account2;
    address internal constant entityRep = account3;

    event EntityDeposit(address indexed caller, address indexed unit, uint256 indexed amount);
    event NewPolicy(address indexed policy, address indexed entity, address indexed deployer);

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        systemContext = acl.systemContext();

        commonUpgradeFacet = new CommonUpgradeFacet(address(settings));

        weth = new DummyToken("Wrapped ETH", "WETH", 18, 0, false);
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

        marketProxy = new Market(address(settings));
        vm.label(address(marketProxy), "Market Proxy Diamond");
        // marketProxy proxy diamond
        settings.setAddress(address(settings), SETTING_MARKET, address(marketProxy));

        market = IMarket(address(marketProxy));

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

        entityAddress = entityDeployer.getChild(1);

        entity = IEntity(entityAddress);

        vm.label(address(weth), "WETH False");
        vm.label(address(wethTrue), "WETH True");
        vm.label(address(this), "Account 0 - Test Contract");
        vm.label(address(0xACC1), "Account 1");
        vm.label(address(0xACC2), "Account 2");
        vm.label(address(0xACC3), "Account 3");
        vm.label(address(0xACC4), "Account 4");
        vm.label(address(0xACC5), "Account 5");
        vm.label(address(0xACC6), "Account 6");
        vm.label(address(0xACC7), "Account 7");
        vm.label(address(0xACC8), "Account 8");
        vm.label(address(0xACC9), "Account 9");
    }

    struct VersionInfo {
        string num;
        uint256 date;
        string hashOut;
    }

    function testCreateEntity() public {
        // entityAdmin = address(this);
        // entityDeployer.deploy(entityAdmin, entityContext);

        // address entityAddress = entityDeployer.getChild(1);
        // address entityAddress = 0x7860e8719387c0FfBAFBfFE3bcD111F665a63EE4;

        // address parentAddy = entity.getParent();
        // address parentAddy = IEntity(address(addys[0])).getParent();
        // console.log(parentAddy);

        // assertEq(address(parentAddy), address(entityDeployer));

        settings.getRootAddresses(SETTING_ENTITY_IMPL);
        DummyEntityFacet dummyEntityTestFacet = new DummyEntityFacet();

        address delegateAddress = IProxy(address(entityAddress)).getDelegateAddress();
        console.log("Delegate Address", delegateAddress);

        address[] memory upgradeAddys = new address[](1);
        // upgradeAddys[0] = address(dummyEntityTestFacet);
        upgradeAddys[0] = address(entityCoreFacet);
        vm.expectRevert("Adding functions failed.");
        IEntity(delegateAddress).upgrade(upgradeAddys);
        // entity.upgrade(upgradeAddys);

        VersionInfo memory vinfo;
        (vinfo.num, vinfo.date, vinfo.hashOut) = entity.getVersionInfo();
    }

    function testUpgradeEntity() public {
        // entityAdmin = address(this);
        // entityDeployer.deploy(entityAdmin, entityContext);

        // address entityAddress = entityDeployer.getChild(1);
        address delegateAddress = IProxy(address(entityAddress)).getDelegateAddress();
        DummyEntityFacet dummyEntityTestFacet = new DummyEntityFacet();
        address[] memory upgradeAddys = new address[](1);
        upgradeAddys[0] = address(dummyEntityTestFacet);
        IEntity(delegateAddress).upgrade(upgradeAddys);

        // no point testing this.
        uint256 bal = entity.getBalance(address(this));

        console.log("bal:", bal);
    }

    function testFreezeUpgrades() public {
        address delegateAddress = IProxy(address(entityAddress)).getDelegateAddress();
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

        // address entityAddress = entityDeployer.getChild(1);
        FreezeUpgradesFacet freezeUpgradesFacet = new FreezeUpgradesFacet();
        address[] memory upgradeAddys = new address[](1);
        upgradeAddys[0] = address(freezeUpgradesFacet);
        vm.expectRevert("external caller not allowed");
        IDiamondProxy(entityAddress).registerFacets(upgradeAddys);

        // address delegateAddress = IProxy(address(entityAddress)).getDelegateAddress();
        // DummyEntityFacet dummyEntityTestFacet = new DummyEntityFacet();
        // FreezeUpgradesFacet freezeUpgradesFacet = new FreezeUpgradesFacet();
        // address[] memory upgradeAddys = new address[](1);
        // upgradeAddys[0] = address(freezeUpgradesFacet);
        // IEntity(delegateAddress).upgrade(upgradeAddys);
    }

    function testEntityDeposit() public {
        weth.deposit{ value: 10 }();
        weth.approve(address(entityAddress), 10);
        vm.expectRevert("DummyToken: transfer amount exceeds allowance");
        entity.deposit(address(weth), 11);

        vm.expectEmit(true, true, true, true);
        emit EntityDeposit(address(this), address(weth), 10);
        entity.deposit(address(weth), 10);

        assertEq(weth.balanceOf(address(entityAddress)), 10);
        assertEq(entity.getBalance(address(weth)), 10);

        vm.expectRevert("must be entity admin");
        vm.prank(address(0xBEEF));
        entity.withdraw(address(weth), 10);

        entity.withdraw(address(weth), 10);
        assertEq(weth.balanceOf(address(this)), 10);

        weth.deposit{ value: 200 }();

        weth.transfer(address(entityAddress), 100);

        weth.approve(address(entityAddress), 100);
        entity.deposit(address(weth), 10);
        assertEq(weth.balanceOf(address(entityAddress)), 110);
        assertEq(entity.getBalance(address(weth)), 10);

        vm.expectRevert("exceeds entity balance");
        entity.withdraw(address(weth), 11);

        entity.withdraw(address(weth), 10);

        assertEq(entity.getBalance(address(weth)), 0);

        vm.expectRevert("exceeds entity balance");
        entity.withdraw(address(weth), 11);
    }

    function testEntityTrade() public {
        weth.deposit{ value: 10 }();
        weth.approve(address(entityAddress), 10);
        entity.deposit(address(weth), 10);

        vm.expectRevert("must be trader");
        entity.trade(address(weth), 1, address(wethTrue), 1);

        acl.assignRole(entity.aclContext(), address(0xD00D), ROLE_ENTITY_REP);

        vm.prank(address(0xD00D));
        entity.trade(address(weth), 1, address(wethTrue), 1);

        vm.deal(address(0xFEED), 1 ether);
        vm.startPrank(address(0xFEED));
        wethTrue.deposit{ value: 1 }();

        wethTrue.approve(address(marketProxy), 1);
        uint256 offerId = market.getLastOfferId();

        market.buy(offerId, 1);

        assertEq(weth.balanceOf(address(0xFEED)), 1);

        weth.deposit{ value: 200 }();

        weth.transfer(address(entityAddress), 101);
        vm.stopPrank();
        assertEq(weth.balanceOf(address(entityAddress)), 110);

        vm.startPrank(address(0xD00D));
        vm.expectRevert("exceeds entity balance");
        entity.trade(address(weth), 11, address(wethTrue), 1);

        entity.trade(address(weth), 10, address(wethTrue), 1);
    }

    function testEntitySellAtBestPrice() public {
        weth.deposit{ value: 10 }();
        weth.approve(address(entityAddress), 10);
        entity.deposit(address(weth), 10);

        vm.expectRevert("must be trader");
        entity.sellAtBestPrice(address(weth), 1, address(wethTrue));

        acl.assignRole(entity.aclContext(), address(0xD00D), ROLE_ENTITY_REP);

        vm.deal(address(0x7AAA), 1 ether);
        vm.startPrank(address(0x7AAA));
        wethTrue.deposit{ value: 100 }();
        wethTrue.approve(address(marketProxy), 100);
        market.executeLimitOffer(address(wethTrue), 100, address(weth), 3, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.deal(address(0x8BBB), 1 ether);
        vm.startPrank(address(0x8BBB));
        wethTrue.deposit{ value: 50 }();
        wethTrue.approve(address(marketProxy), 50);
        market.executeLimitOffer(address(wethTrue), 50, address(weth), 5, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        uint256 offerId = market.getBestOfferId(address(wethTrue), address(weth));

        vm.prank(address(0xD00D));
        entity.sellAtBestPrice(address(weth), 5, address(wethTrue));

        assertEq(wethTrue.balanceOf(address(entityAddress)), 120);
        assertEq(weth.balanceOf(address(0x7AAA)), 3);
        assertEq(weth.balanceOf(address(0x8BBB)), 2);

        assertEq(weth.balanceOf(address(entityAddress)), 5);

        weth.deposit{ value: 200 }();
        weth.transfer(address(entityAddress), 100);

        assertEq(weth.balanceOf(address(entityAddress)), 105);

        vm.startPrank(address(0x8BBB));
        wethTrue.deposit{ value: 50 }();
        wethTrue.approve(address(marketProxy), 50);
        market.executeLimitOffer(address(wethTrue), 50, address(weth), 10, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        vm.startPrank(address(0xD00D));
        vm.expectRevert("exceeds entity balance");
        entity.sellAtBestPrice(address(weth), 11, address(wethTrue));

        entity.sellAtBestPrice(address(weth), 10, address(wethTrue));
    }

    struct TokenInfo {
        address tokenAddress;
        uint256 currentTokenSaleOfferId;
    }

    function testEntityTokens() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);

        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));
        assertEq(tokenInfo.tokenAddress, address(0));
        assertEq(tokenInfo.currentTokenSaleOfferId, 0);

        vm.expectRevert("must be system mgr");
        vm.prank(account3);
        entity.startTokenSale(500, address(weth), 1000);

        // deploys an entity token representing the underlying deposited token
        entity.startTokenSale(500, address(weth), 1000);

        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        // check if not null
        // assertEq(tokenInfo.tokenAddress, address(weth));
        assertEq(tokenInfo.currentTokenSaleOfferId, 1);

        uint256 offerId = market.getLastOfferId();

        IMarketDataFacet.OfferState memory offerState = market.getOffer(offerId);
        assertEq(offerState.creator, entityAddress);
        assertEq(offerState.sellToken, tokenInfo.tokenAddress);
        assertEq(offerState.sellAmount, 500);
        assertEq(offerState.buyToken, address(weth));
        assertEq(offerState.buyAmount, 1000);
        assertTrue(market.isActive(offerId));
        assertEq(offerState.feeSchedule, FEE_SCHEDULE_PLATFORM_ACTION);

        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 500);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(marketProxy)), 500);
        assertEq(IERC20(tokenInfo.tokenAddress).allowance(address(marketProxy), entityAddress), 0);
        assertEq(IERC20(tokenInfo.tokenAddress).name(), string.concat("NAYMS-", address(weth).toString(), "-", entityAddress.toString(), "-ENTITY"));
        assertEq(IERC20(tokenInfo.tokenAddress).symbol(), string.concat("N-", address(weth).toString().substring(2, 3), "-", entityAddress.toString().substring(2, 3), "-E"));

        // only one sale can be in progress at a time
        vm.expectRevert("token sale in progress");
        entity.startTokenSale(500, address(weth), 1000);

        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        offerState = market.getOffer(offerId);
        assertEq(offerState.sellToken, tokenInfo.tokenAddress);
        assertEq(offerState.sellAmount, 250);
        assertEq(offerState.buyToken, address(weth));
        assertEq(offerState.buyAmount, 500);
        assertTrue(market.isActive(offerId));

        assertEq(weth.balanceOf(entityAddress), 500);
        assertEq(entity.getBalance(address(weth)), 500);

        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 250);
        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 500);

        // fully sell tokens
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        market.isActive(offerId);

        assertEq(weth.balanceOf(entityAddress), 1000);
        assertEq(entity.getBalance(address(weth)), 1000);

        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 500);
        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 500);

        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));
        assertEq(tokenInfo.currentTokenSaleOfferId, 0);
    }

    function testEntityTokensTransfers() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);

        entity.startTokenSale(500, address(weth), 1000);

        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);

        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        // settings.setAddress(address(settings), SETTING_MARKET, address(marketProxy));

        // only marketProxy can transfer tokens
        vm.prank(address(marketProxy));
        IERC20(tokenInfo.tokenAddress).transfer(account1, 1);

        vm.expectRevert("only nayms market is allowed to transfer");
        IERC20(tokenInfo.tokenAddress).transfer(account0, 1);

        // only market can be approved for transfers
        IERC20(tokenInfo.tokenAddress).approve(address(marketProxy), 1);

        vm.expectRevert("only nayms market is allowed to transfer");
        IERC20(tokenInfo.tokenAddress).approve(account1, 1);

        // transfers must be non-zero
        vm.prank(address(marketProxy));
        vm.expectRevert("cannot transfer zero");
        IERC20(tokenInfo.tokenAddress).transfer(account1, 0);

        // console.log(address(this).balance);
        // weth.deposit{value: 500}();
        // weth.approve(address(marketProxy), 500);
        // market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");
        //can only be transferred by the marketProxy
    }

    function testEntityTokensTransfersOnceSold() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);

        entity.startTokenSale(500, address(weth), 1000);

        weth.deposit{ value: 1000 }();
        weth.approve(address(marketProxy), 1000);

        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 1000, tokenInfo.tokenAddress, 500, FEE_SCHEDULE_STANDARD, address(0), "");
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 500);
        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 500);

        // can only be transferred by the marketProxy
        vm.expectRevert("only nayms market is allowed to transfer");
        IERC20(tokenInfo.tokenAddress).approve(account2, 1);
        vm.expectRevert("only nayms market is allowed to transfer");
        IERC20(tokenInfo.tokenAddress).transfer(account2, 1);

        // can be burnt
        entity.burnTokens(address(weth), 1);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 499);
        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 499);

        // cannot be burnt if more than balance
        vm.expectRevert("not enough balance to burn");
        entity.burnTokens(address(weth), 1000);
        vm.expectRevert("cannot burn zero");
        entity.burnTokens(address(weth), 0);
    }

    function testCancelTokenSale() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);

        vm.expectRevert("no active token sale");
        entity.cancelTokenSale(address(weth));
        entity.startTokenSale(500, address(weth), 1000);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 500);
        weth.deposit{ value: 1000 }();
        weth.approve(address(marketProxy), 1000);

        vm.prank(account3);
        vm.expectRevert("must be system mgr");
        entity.cancelTokenSale(address(weth));

        entity.cancelTokenSale(address(weth));

        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        assertEq(tokenInfo.currentTokenSaleOfferId, 0);
        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 0);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 0);

        entity.startTokenSale(500, address(weth), 1000);
        address tokenAddress2;
        (tokenAddress2, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        assertEq(tokenInfo.tokenAddress, tokenAddress2);
        // and re-uses existing token if new sale is initiated
        // market.executeLimitOffer(address(weth), 1000, tokenInfo.tokenAddress, 500, FEE_SCHEDULE_STANDARD, address(0), "");
        // assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 500);
        // assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 500);

        // // can only be transferred by the marketProxy
        // vm.expectRevert("only nayms marketProxy is allowed to transfer");
        // IERC20(tokenInfo.tokenAddress).approve(account2, 1);
        // vm.expectRevert("only nayms marketProxy is allowed to transfer");
        // IERC20(tokenInfo.tokenAddress).transfer(account2, 1);

        // // can be burnt
        // entity.burnTokens(address(weth), 1);
        // assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 499);
        // assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 499);

        // // cannot be burnt if more than balance
        // vm.expectRevert("not enough balance to burn");
        // entity.burnTokens(address(weth), 1000);
        // vm.expectRevert("cannot burn zero");
        // entity.burnTokens(address(weth), 0);
    }

    function testPreventWithdraws() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);

        entity.startTokenSale(500, address(weth), 1000);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 500);
        weth.deposit{ value: 1000 }();
        weth.approve(address(entityAddress), 1000);

        entity.deposit(address(weth), 1000);

        // when token supply is non-zero
        vm.expectRevert("cannot withdraw while tokens exist");
        entity.withdraw(address(weth), 1);

        // once token supply is non-zero
        entity.cancelTokenSale(address(weth));
        entity.withdraw(address(weth), 1);
    }

    // token holder tracking
    function testGetNumTokenHolders() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);

        entity.startTokenSale(500, address(weth), 1000);

        uint256 numTokenHolders = entity.getNumTokenHolders(address(weth));
        assertEq(numTokenHolders, 1);

        address tokenHolder1 = entity.getTokenHolderAtIndex(address(weth), 1);
        assertEq(tokenHolder1, address(marketProxy));

        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);

        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");
        numTokenHolders = entity.getNumTokenHolders(address(weth));
        assertEq(numTokenHolders, 2);

        address tokenHolder2 = entity.getTokenHolderAtIndex(address(weth), 2);
        assertEq(tokenHolder2, address(this));

        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 250);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(marketProxy)), 250);
        assertEq(weth.balanceOf(address(entityAddress)), 500);
        assertEq(entity.getBalance(address(weth)), 500);

        // ensures entity is not a holder after token sale is complete
        entity.cancelTokenSale(address(weth));
        numTokenHolders = entity.getNumTokenHolders(address(weth));
        assertEq(numTokenHolders, 1);

        tokenHolder1 = entity.getTokenHolderAtIndex(address(weth), 1);
        assertEq(tokenHolder1, address(this));
    }

    function testGetNumTokenHoldersBetweenAccs() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        entity.cancelTokenSale(address(weth));

        settings.setAddress(address(settings), SETTING_MARKET, address(this));
        // works for multiple holders
        IERC20(tokenInfo.tokenAddress).transfer(account1, 1);
        IERC20(tokenInfo.tokenAddress).transfer(account2, 1);

        assertEq(entity.getNumTokenHolders(address(weth)), 3);
        assertEq(entity.getTokenHolderAtIndex(address(weth), 1), address(this));
        assertEq(entity.getTokenHolderAtIndex(address(weth), 2), account1);
        assertEq(entity.getTokenHolderAtIndex(address(weth), 3), account2);
    }

    function testGetNumTokenHoldersBetweenAccsZero() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        entity.cancelTokenSale(address(weth));

        settings.setAddress(address(settings), SETTING_MARKET, address(this));

        // removes holder once their balance goes to zero
        IERC20(tokenInfo.tokenAddress).transfer(account1, 1);

        assertEq(entity.getNumTokenHolders(address(weth)), 2);
        assertEq(entity.getTokenHolderAtIndex(address(weth), 1), address(this));
        assertEq(entity.getTokenHolderAtIndex(address(weth), 2), account1);

        IERC20(tokenInfo.tokenAddress).transfer(account1, 249);

        assertEq(entity.getNumTokenHolders(address(weth)), 1);
        assertEq(entity.getTokenHolderAtIndex(address(weth), 1), account1);
    }

    function testGetNumTokenHoldersBetweenAccsReAdd() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        entity.cancelTokenSale(address(weth));

        settings.setAddress(address(settings), SETTING_MARKET, address(this));

        // re-adds holder if their balance goes to zero but then goes back up again
        IERC20(tokenInfo.tokenAddress).transfer(account1, 250);

        assertEq(entity.getNumTokenHolders(address(weth)), 1);
        // assertEq(entity.getTokenHolderAtIndex(address(weth), 1), address(this));
        assertEq(entity.getTokenHolderAtIndex(address(weth), 2), account1);
    }

    function testGetNumTokenHoldersBetweenAccsBurnt() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        entity.cancelTokenSale(address(weth));

        settings.setAddress(address(settings), SETTING_MARKET, address(this));

        // removes holder if their balance gets burnt
        IERC20(tokenInfo.tokenAddress).transfer(account1, 249);

        vm.startPrank(account1);
        entity.burnTokens(address(weth), 1);
        assertEq(entity.getNumTokenHolders(address(weth)), 2);
        assertEq(entity.getTokenHolderAtIndex(address(weth), 1), address(this));
        assertEq(entity.getTokenHolderAtIndex(address(weth), 2), account1);

        entity.burnTokens(address(weth), 248);
        assertEq(entity.getNumTokenHolders(address(weth)), 1);
        assertEq(entity.getTokenHolderAtIndex(address(weth), 1), address(this));
    }

    function testDividendPayouts() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        // assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(account1), 250);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(marketProxy)), 250);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 250);

        assertEq(entity.getBalance(address(weth)), 500);

        entity.cancelTokenSale(address(weth));

        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 250);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(marketProxy)), 0);
        assertEq(entity.getNumTokenHolders(address(weth)), 1);
        assertEq(entity.getTokenHolderAtIndex(address(weth), 1), address(this));

        // cannot happen when token sale is in progress
        entity.startTokenSale(1, address(weth), 1);
        vm.expectRevert("token sale in progress");
        entity.payDividend(address(weth), 1);
        entity.cancelTokenSale(address(weth));
        entity.payDividend(address(weth), 1);
    }

    function testDividendPayoutsMultipleHolders() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        entity.cancelTokenSale(address(weth));

        settings.setAddress(address(settings), SETTING_MARKET, address(this));
        IERC20(tokenInfo.tokenAddress).transfer(account1, 100);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(address(this)), 150);
        assertEq(IERC20(tokenInfo.tokenAddress).balanceOf(account1), 100);
        assertEq(IERC20(tokenInfo.tokenAddress).totalSupply(), 250);
        assertEq(entity.getNumTokenHolders(address(weth)), 2);

        // must not exceed entity balance
        vm.expectRevert("exceeds entity balance");
        entity.payDividend(address(weth), 501);

        // get allocated proportionately to holders
        entity.payDividend(address(weth), 500);

        assertEq(entity.getBalance(address(weth)), 0);
        assertEq(entity.getWithdrawableDividend(address(weth), address(this)), 300);
        assertEq(entity.getWithdrawableDividend(address(weth), account1), 200);
    }

    function testDividendPayoutsMultipleHoldersPreviousPayouts() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        entity.cancelTokenSale(address(weth));

        settings.setAddress(address(settings), SETTING_MARKET, address(this));
        IERC20(tokenInfo.tokenAddress).transfer(account1, 100);

        // add to previous payouts
        entity.payDividend(address(weth), 100);

        assertEq(entity.getBalance(address(weth)), 400);
        assertEq(entity.getWithdrawableDividend(address(weth), address(this)), 60);
        assertEq(entity.getWithdrawableDividend(address(weth), account1), 40);

        entity.payDividend(address(weth), 50);

        assertEq(entity.getBalance(address(weth)), 350);
        assertEq(entity.getWithdrawableDividend(address(weth), address(this)), 90);
        assertEq(entity.getWithdrawableDividend(address(weth), account1), 60);

        entity.withdrawDividend(address(weth));
        entity.withdrawDividend(address(weth));
    }

    function testDividendPayoutsWithdraw() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        entity.startTokenSale(500, address(weth), 1000);
        weth.deposit{ value: 500 }();
        weth.approve(address(marketProxy), 500);
        TokenInfo memory tokenInfo;
        (tokenInfo.tokenAddress, tokenInfo.currentTokenSaleOfferId) = entity.getTokenInfo(address(weth));

        market.executeLimitOffer(address(weth), 500, tokenInfo.tokenAddress, 250, FEE_SCHEDULE_STANDARD, address(0), "");

        entity.cancelTokenSale(address(weth));

        settings.setAddress(address(settings), SETTING_MARKET, address(this));
        IERC20(tokenInfo.tokenAddress).transfer(account1, 100);

        entity.payDividend(address(weth), 100);

        assertEq(entity.getWithdrawableDividend(address(weth), address(this)), 60);
        assertEq(entity.getWithdrawableDividend(address(weth), account1), 40);

        IERC20(tokenInfo.tokenAddress).transferFrom(account1, address(this), 100);

        entity.payDividend(address(weth), 50);

        assertEq(entity.getWithdrawableDividend(address(weth), address(this)), 110);
        assertEq(entity.getWithdrawableDividend(address(weth), account1), 40);

        vm.prank(account1);
        entity.withdrawDividend(address(weth));
        assertEq(entity.getWithdrawableDividend(address(weth), account1), 0);
        assertEq(weth.balanceOf(account1), 40);
    }

    function testCreatePolicy() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        acl.assignRole(entity.aclContext(), entityRep, ROLE_ENTITY_REP);
        entity.updateAllowPolicy(true);

        assertTrue(entity.allowPolicy());

        uint256 initiationDateDiff;
        uint256 startDateDiff;
        uint256 maturationDateDiff;
        uint256 brokerCommissionBP;
        uint256 underwriterCommissionBP;
        uint256 claimsAdminCommissionBP;
        uint256 naymsCommissionBP;

        initiationDateDiff = 1000;
        startDateDiff = 2000;
        maturationDateDiff = 3000;

        uint256[] memory types = new uint256[](9);
        // policy type
        types[0] = POLICY_TYPE_SPV;
        // time between successive premium payments
        types[1] = 10;
        // initiation date
        types[2] = block.timestamp + initiationDateDiff;
        // start date
        types[3] = block.timestamp + startDateDiff;
        // maturation date
        types[4] = block.timestamp + maturationDateDiff;
        // broker commission
        types[5] = brokerCommissionBP;
        // underwriter commission
        types[6] = underwriterCommissionBP;
        // claims admin commission
        types[7] = claimsAdminCommissionBP;
        // nayms commission
        types[8] = naymsCommissionBP;

        address[] memory addresses = new address[](6);
        // policy premium currency address
        addresses[0] = address(0);
        // treasury address
        addresses[1] = entityAddress;
        // broker entityAddress address
        addresses[2] = entityAddress;
        // underwriter entityAddress address
        addresses[3] = entityAddress;
        // claims admin entityAddress address
        addresses[4] = address(0);
        // insured party entityAddress address
        addresses[5] = address(0);

        uint256[][] memory trancheData = new uint256[][](1);

        uint256[] memory innerTrancheData = new uint256[](4);
        innerTrancheData[0] = 100; // num shares
        innerTrancheData[1] = 1; // price per share amount
        innerTrancheData[2] = 1100;
        innerTrancheData[3] = 20;
        // innerTrancheData[4] = 0;
        // innerTrancheData[5] = 10;

        trancheData[0] = innerTrancheData;

        bytes[] memory approvalSignatures = new bytes[](0);

        bytes32 policyId = "0x1";

        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);

        // and underwriter acl context must be same as creating entityAddress
        Entity entity2 = new Entity(address(settings), entityAdmin, "");

        addresses[3] = address(entity2);
        vm.expectRevert("underwriter ACL context must match");
        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);

        Entity entity3 = new Entity(address(settings), entityAdmin, entity.aclContext());
        addresses[3] = address(entity3);

        // vm.expectEmit(true, true, true, true);
        // emit NewPolicy(address(this), address(weth), address(this));
        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);

        assertEq(entity.getNumChildren(), 2);

        address policyAddress = entity.getChild(2);
        assertTrue(entity.hasChild(policyAddress));
        assertEq(IPolicy(policyAddress).getParent(), entityAddress);

        IPolicy(policyAddress).getInfo(); // todo: check properties

        // and have the original caller set as policy owner
        assertEq(acl.hasRole(IPolicy(policyAddress).aclContext(), address(this), ROLE_POLICY_OWNER), HAS_ROLE_CONTEXT);
    }

    function testPayTranchePremium() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        acl.assignRole(entity.aclContext(), entityRep, ROLE_ENTITY_REP);
        entity.updateAllowPolicy(true);

        uint256 initiationDateDiff;
        uint256 startDateDiff;
        uint256 maturationDateDiff;
        uint256 brokerCommissionBP;
        uint256 underwriterCommissionBP;
        uint256 claimsAdminCommissionBP;
        uint256 naymsCommissionBP;

        initiationDateDiff = 1000;
        startDateDiff = 2000;
        maturationDateDiff = 3000;

        uint256[] memory types = new uint256[](9);
        // policy type
        types[0] = POLICY_TYPE_SPV;
        // time between successive premium payments
        types[1] = 10;
        // initiation date
        types[2] = block.timestamp + initiationDateDiff;
        // start date
        types[3] = block.timestamp + startDateDiff;
        // maturation date
        types[4] = block.timestamp + maturationDateDiff;
        // broker commission
        types[5] = brokerCommissionBP;
        // underwriter commission
        types[6] = underwriterCommissionBP;
        // claims admin commission
        types[7] = claimsAdminCommissionBP;
        // nayms commission
        types[8] = naymsCommissionBP;

        address[] memory addresses = new address[](6);
        // policy premium currency address
        addresses[0] = address(0);
        // treasury address
        addresses[1] = entityAddress;
        // broker entityAddress address
        addresses[2] = entityAddress;
        // underwriter entityAddress address
        addresses[3] = entityAddress;
        // claims admin entityAddress address
        addresses[4] = address(0);
        // insured party entityAddress address
        addresses[5] = address(0);

        uint256[][] memory trancheData = new uint256[][](1);

        uint256[] memory innerTrancheData = new uint256[](4);
        innerTrancheData[0] = 100; // num shares
        innerTrancheData[1] = 1; // price per share amount
        innerTrancheData[2] = 1100;
        innerTrancheData[3] = 20;

        trancheData[0] = innerTrancheData;

        bytes[] memory approvalSignatures = new bytes[](0);

        bytes32 policyId = "0x1";

        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);
        entity.getNumChildren();
        address policyAddress = entity.getChild(1);
        IPolicy policy = IPolicy(policyAddress);
        // policy.createTranche();
    }

    function testEntityCreateSimplePolicyReverts() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        acl.assignRole(entity.aclContext(), entityRep, ROLE_ENTITY_REP);
        entity.updateAllowPolicy(true);

        bytes32 simplePolicyId = "0x1";
        uint256 startDate;
        uint256 maturationDate;
        address underlying = address(weth);
        uint256 limit;

        address[] memory stakeHolders = new address[](5);
        stakeHolders[0] = entityAddress;
        stakeHolders[1] = entityAddress;
        stakeHolders[2] = address(0);
        stakeHolders[3] = entityAddress;
        stakeHolders[4] = entityAddress;

        bytes[] memory approvalSignatures = new bytes[](0);

        vm.expectRevert("creation disabled");
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        entity.updateAllowSimplePolicy(true);
        assertTrue(entity.allowSimplePolicy());

        uint256 collateralRatio = 500;
        uint256 maxCapital = 100;

        // currency is enabled
        vm.expectRevert("currency disabled");
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        entity.updateEnabledCurrency(underlying, collateralRatio, maxCapital);

        // limit is greater than 0
        vm.expectRevert("limit not > 0");
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        // limit is below max capital
        limit = 150;
        vm.expectRevert("max capital exceeded");
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        // collateral ratio is valid
        collateralRatio = 1500;
        maxCapital = 100;
        vm.expectRevert("collateral ratio is 0-1000");
        entity.updateEnabledCurrency(underlying, collateralRatio, maxCapital);

        // collateral ratio is met
        collateralRatio = 500;
        maxCapital = 100;
        entity.updateEnabledCurrency(underlying, collateralRatio, maxCapital);

        limit = 100;
        vm.expectRevert("collateral ratio not met");
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        // caller is an underwriter or broker
        weth.deposit{ value: 500 }();
        weth.approve(entityAddress, 500);

        entity.deposit(address(weth), 500);
        entity.updateEnabledCurrency(underlying, 500, 1000);
        vm.expectRevert("must be broker or underwriter");
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);
    }

    function testEntityCreateSimplePolicyAfterCreation() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        acl.assignRole(entity.aclContext(), entityRep, ROLE_ENTITY_REP);
        entity.updateAllowPolicy(true);

        uint256 startDate;
        uint256 maturationDate;
        address underlying = address(weth);
        uint256 limit = 100;
        bytes32 simplePolicyId = "0x1";

        address[] memory stakeHolders = new address[](5);
        stakeHolders[0] = entityAddress;
        stakeHolders[1] = entityAddress;
        stakeHolders[2] = address(0);
        stakeHolders[3] = entityAddress;
        stakeHolders[4] = entityAddress;

        bytes[] memory approvalSignatures = new bytes[](0);

        entity.updateAllowSimplePolicy(true);

        uint256 collateralRatio = 500;
        uint256 maxCapital = 100;

        entity.updateEnabledCurrency(underlying, collateralRatio, maxCapital);

        weth.deposit{ value: 500 }();
        weth.approve(entityAddress, 500);
        entity.deposit(address(weth), 500);

        acl.assignRole(systemContext, entityAddress, ROLE_UNDERWRITER);
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        address policyAddress = 0x84EC5D405CC8B587c624836b53a28eb29F83d162;
        ISimplePolicy2 simplePolicy = ISimplePolicy2(policyAddress);

        // they exist and have their properties set
        (bytes32 simplePolicyIdChk, uint256 policyNumber, , , , , ) = simplePolicy.getSimplePolicyInfo();

        // number of policies is increased
        assertEq(entity.getNumSimplePolicies(), 1);

        // lookup is available
        assertEq(entity.getSimplePolicyId(policyNumber), simplePolicyId);

        // claims can be paid out - only by the system manager
        vm.startPrank(entityRep);
        vm.expectRevert("must be system mgr");
        entity.paySimpleClaim(simplePolicyId, 1000);
        vm.stopPrank();

        // claims can be paid out - and amount is greater than 0
        vm.expectRevert("invalid claim amount");
        entity.paySimpleClaim(simplePolicyId, 0);

        // claims can be paid out - and total amount of claims paid is below the limit
        uint256 previousBalance = entity.getBalance(underlying);

        vm.expectRevert("exceeds policy limit");
        entity.paySimpleClaim(simplePolicyId, 101);

        // then the payout goes to the insured party
        uint256 claimAmount = 30;
        entity.paySimpleClaim(simplePolicyId, claimAmount);

        assertEq(entity.getBalance(underlying), previousBalance - claimAmount);

        (, uint256 claimsPaid) = entity.getPremiumsAndClaimsPaid(simplePolicyId);
        assertEq(claimsPaid, claimAmount);
    }

    function testEntityPaySimplePremium() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        acl.assignRole(entity.aclContext(), entityRep, ROLE_ENTITY_REP);
        entity.updateAllowPolicy(true);

        uint256 startDate;
        uint256 maturationDate;
        address underlying = address(weth);
        uint256 limit = 100;
        bytes32 simplePolicyId = "0x1";

        address[] memory stakeHolders = new address[](5);
        stakeHolders[0] = entityAddress;
        stakeHolders[1] = entityAddress;
        stakeHolders[2] = address(0);
        stakeHolders[3] = entityAddress;
        stakeHolders[4] = entityAddress;

        bytes[] memory approvalSignatures = new bytes[](0);

        entity.updateAllowSimplePolicy(true);

        uint256 collateralRatio = 500;
        uint256 maxCapital = 100;

        entity.updateEnabledCurrency(underlying, collateralRatio, maxCapital);

        weth.deposit{ value: 500 }();
        weth.approve(entityAddress, 500);
        entity.deposit(address(weth), 500);

        acl.assignRole(systemContext, entityAddress, ROLE_UNDERWRITER);
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        address policyAddress = 0x84EC5D405CC8B587c624836b53a28eb29F83d162;
        ISimplePolicy2 simplePolicy = ISimplePolicy2(policyAddress);

        // they exist and have their properties set
        (bytes32 simplePolicyIdChk, uint256 policyNumber, , , , , ) = simplePolicy.getSimplePolicyInfo();

        // premiums can be payed out - if done by entity represetative
        // vm.startPrank(entityRep);
        // vm.expectRevert("not an entity rep");
        // entity.paySimplePremium(simplePolicyId, entityAddress, 0);

        // premiums can be payed out - if amount is greater than 0
        vm.expectRevert("invalid premium amount");
        entity.paySimplePremium(simplePolicyId, entityAddress, 0);

        // premiums can be payed out - and the payout goes to the entity
        uint256 premiumAmount = 10;
        uint256 previousBalance = entity.getBalance(underlying);
        entity.paySimplePremium(simplePolicyId, entityAddress, premiumAmount);

        assertEq(entity.getBalance(underlying), previousBalance + premiumAmount);

        (uint256 premiumsPaid, ) = entity.getPremiumsAndClaimsPaid(simplePolicyId);
        assertEq(premiumsPaid, premiumAmount);
    }

    function testEntityHeartBeatFunction() public {
        acl.assignRole(entity.aclContext(), systemManager, ROLE_SYSTEM_MANAGER);
        acl.assignRole(entity.aclContext(), entityManager, ROLE_ENTITY_MANAGER);
        acl.assignRole(entity.aclContext(), entityRep, ROLE_ENTITY_REP);
        entity.updateAllowPolicy(true);

        uint256 startDate;
        uint256 maturationDate = 10;
        address underlying = address(weth);
        uint256 limit = 100;
        bytes32 simplePolicyId = "0x1";

        address[] memory stakeHolders = new address[](5);
        stakeHolders[0] = entityAddress;
        stakeHolders[1] = entityAddress;
        stakeHolders[2] = address(0);
        stakeHolders[3] = entityAddress;
        stakeHolders[4] = entityAddress;

        bytes[] memory approvalSignatures = new bytes[](0);

        entity.updateAllowSimplePolicy(true);

        uint256 collateralRatio = 500;
        uint256 maxCapital = 100;

        entity.updateEnabledCurrency(underlying, collateralRatio, maxCapital);

        weth.deposit{ value: 500 }();
        weth.approve(entityAddress, 500);
        entity.deposit(address(weth), 500);

        acl.assignRole(systemContext, entityAddress, ROLE_UNDERWRITER);
        entity.createSimplePolicy(simplePolicyId, startDate, maturationDate, underlying, limit, stakeHolders);

        address policyAddress = 0x84EC5D405CC8B587c624836b53a28eb29F83d162;
        ISimplePolicy2 simplePolicy = ISimplePolicy2(policyAddress);

        // activates the policy after start date

        entity.checkAndUpdateState(simplePolicyId);

        (, , , , , , uint256 state) = simplePolicy.getSimplePolicyInfo();
        assertEq(state, POLICY_STATE_ACTIVE);

        // updates state and total limit accordingly after maturation date
        (, , uint256 totalLimitBefore) = entity.getEnabledCurrency(underlying);
        vm.warp(11);
        entity.checkAndUpdateState(simplePolicyId);
        (, , , , , , state) = simplePolicy.getSimplePolicyInfo();
        assertEq(state, POLICY_STATE_MATURED);

        (, , uint256 totalLimitAfter) = entity.getEnabledCurrency(underlying);
        assertEq(totalLimitAfter, totalLimitBefore - limit);

        // currency can be disabled
        collateralRatio = 0;
        maxCapital = 0;

        entity.getEnabledCurrencies();
        entity.updateEnabledCurrency(underlying, collateralRatio, maxCapital);
        entity.getEnabledCurrencies(); // todo check array
    }
}

// 1. ACL
// 2. Settings
// - marketProxy?
// 3. EntityDeployer
// 4. FeeBank
// Platform Token(s)
// Policy Delegate
// Entity Delegate
// entityAddress checks with entityAddress delegate to call methods

// FreezeUpgradesFacet perma freezes upgrades
// Entity has to send eth, then deposit the vault token. This can be done in one method call

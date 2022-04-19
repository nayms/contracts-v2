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

contract IntegrationPortfolioTest is DSTestPlusF, MockAccounts, IACLConstants, ISettingsKeys, IMarketFeeSchedules, IPolicyStates, IPolicyTypes {
    using Address for address;
    using Strings for string;

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

    bytes32 internal entityContext;
    address internal entityAddress;
    address internal underwriterEntityAddress;
    address internal insuredPartyEntityAddress;
    address internal brokerEntityAddress;
    address internal claimsAdminEntityAddress;

    DummyToken internal weth;
    DummyToken internal wethTrue;

    IEntity internal entity;
    IEntity internal underwriter;
    IEntity internal insuredParty;
    IEntity internal broker;
    IEntity internal claimsAdmin;

    IPolicy internal policy;

    address internal account0 = address(this);

    address internal systemManager = account0;
    address internal constant entityManager = account1;
    address internal constant entityAdmin = account2;
    // address internal constant entityRep = account3;
    address internal constant insuredPartyRep = account4;
    address internal constant underwriterRep = account5;
    address internal constant brokerRep = account6;
    address internal constant claimsAdminRep = account7;

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

        entityDeployer.deploy(entityAdmin, "");
        entityAddress = entityDeployer.getChild(1);
        entity = IEntity(entityAddress);

        entityContext = entity.aclContext();

        entityDeployer.deploy(underwriterRep, entityContext);
        entityDeployer.deploy(insuredPartyRep, entityContext);
        entityDeployer.deploy(brokerRep, entityContext);
        entityDeployer.deploy(claimsAdminRep, entityContext);

        underwriterEntityAddress = entityDeployer.getChild(2);
        insuredPartyEntityAddress = entityDeployer.getChild(3);
        brokerEntityAddress = entityDeployer.getChild(4);
        claimsAdminEntityAddress = entityDeployer.getChild(5);

        underwriter = IEntity(underwriterEntityAddress);
        insuredParty = IEntity(insuredPartyEntityAddress);
        broker = IEntity(brokerEntityAddress);
        claimsAdmin = IEntity(claimsAdminEntityAddress);

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
        maturationDateDiff = 4000;

        uint256[] memory types = new uint256[](8);
        // policy type
        types[0] = POLICY_TYPE_PORTFOLIO;
        // initiation date
        types[1] = block.timestamp + initiationDateDiff;
        // start date
        types[2] = block.timestamp + startDateDiff;
        // maturation date
        types[3] = block.timestamp + maturationDateDiff;
        // broker commission
        types[4] = brokerCommissionBP;
        // underwriter commission
        types[5] = underwriterCommissionBP;
        // claims admin commission
        types[6] = claimsAdminCommissionBP;
        // nayms commission
        types[7] = naymsCommissionBP;

        address[] memory addresses = new address[](6);
        // policy premium currency address
        addresses[0] = address(weth);
        // treasury address
        addresses[1] = entityAddress;
        // broker entity address
        addresses[2] = brokerEntityAddress;
        // underwriter entity address
        addresses[3] = underwriterEntityAddress;
        // claims admin entity address
        addresses[4] = claimsAdminEntityAddress;
        // insured party entity address
        addresses[5] = insuredPartyEntityAddress;

        uint256[][] memory trancheData = new uint256[][](0);

        bytes[] memory approvalSignatures = new bytes[](0);

        bytes32 policyId = "0x1";

        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);
        entity.getNumChildren();
        address policyAddress = entity.getChild(1);
        policy = IPolicy(policyAddress);

        entity.updateAllowPolicy(false);

        uint256 numShares = 100;
        uint256 pricePerShareAmount = 2;
        uint256[] memory premiumsDiff = new uint256[](14);
        premiumsDiff[0] = 0 + 1000;
        premiumsDiff[1] = 10;
        premiumsDiff[2] = 500 + 1000;
        premiumsDiff[3] = 20;
        premiumsDiff[4] = 1000 + 1000;
        premiumsDiff[5] = 30;
        premiumsDiff[6] = 1500 + 1000;
        premiumsDiff[7] = 40;
        premiumsDiff[8] = 2000 + 1000;
        premiumsDiff[9] = 50;
        premiumsDiff[10] = 2500 + 1000;
        premiumsDiff[11] = 60;
        premiumsDiff[12] = 3000 + 1000;
        premiumsDiff[13] = 70;
        policy.createTranche(numShares, pricePerShareAmount, premiumsDiff);

        numShares = 50;
        pricePerShareAmount = 2;
        policy.createTranche(numShares, pricePerShareAmount, premiumsDiff);

        acl.assignRole(entity.aclContext(), underwriterRep, ROLE_ENTITY_REP);
        acl.assignRole(entity.aclContext(), insuredPartyRep, ROLE_ENTITY_REP);
        acl.assignRole(entity.aclContext(), brokerRep, ROLE_ENTITY_REP);
        acl.assignRole(entity.aclContext(), claimsAdminRep, ROLE_ENTITY_REP);
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);

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

    function testPolicyGetInfo() public {
        (, , , , , , uint256 numTranches, , uint256 policyType) = policy.getInfo();
        assertEq(numTranches, 2);
        assertEq(policyType, POLICY_TYPE_PORTFOLIO);

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheToken0, address(0));
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheToken1, address(0));
    }

    function testPayTranchePremium() public {
        (, , , , , , uint256 numTranches, uint256 state, uint256 policyType) = policy.getInfo();
        assertEq(state, POLICY_STATE_APPROVED);

        // once initialisation date has passed
        weth.deposit{ value: 20 }();
        weth.approve(address(policy), 20);
        policy.payTranchePremium(0, 10);
        policy.payTranchePremium(1, 10);

        vm.warp(1000); // initiation date

        policy.checkAndUpdateState();
        (, , , , , , , state, ) = policy.getInfo();
        assertEq(state, POLICY_STATE_INITIATED);

        // tranche tokens are not being sold
        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);
        assertEq(initialSaleOfferId, 0);
        (, , , , , , initialSaleOfferId, , ) = policy.getTrancheInfo(1);
        assertEq(initialSaleOfferId, 0);

        // tranches remain in created state
        (, uint256 trancheState, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState, TRANCHE_STATE_CREATED);
        (, trancheState, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState, TRANCHE_STATE_CREATED);
    }

    function testPayTranchePremiumAfterStartDate() public {
        weth.deposit{ value: 20 }();
        weth.approve(address(policy), 20);
        policy.payTranchePremium(0, 10);
        policy.payTranchePremium(1, 10);

        vm.warp(1000); // initiation date

        policy.checkAndUpdateState();

        weth.deposit{ value: 540 }();
        weth.approve(address(policy), 540);
        policy.payTranchePremium(0, 270);
        policy.payTranchePremium(1, 270);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        // tranches are in active state
        (, uint256 trancheState, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState, TRANCHE_STATE_ACTIVE);
        (, trancheState, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState, TRANCHE_STATE_ACTIVE);

        // policy is active
        (, , , , , , , uint256 state, ) = policy.getInfo();
        assertEq(state, POLICY_STATE_ACTIVE);

        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();
    }

    function testPayTranchePremiumAfterMaturationDate() public {
        weth.deposit{ value: 20 }();
        weth.approve(address(policy), 20);
        policy.payTranchePremium(0, 10);
        policy.payTranchePremium(1, 10);

        vm.warp(1000); // initiation date

        policy.checkAndUpdateState();

        weth.deposit{ value: 540 }();
        weth.approve(address(policy), 540);
        policy.payTranchePremium(0, 270);
        policy.payTranchePremium(1, 270);

        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 state, ) = policy.getInfo();
        assertEq(state, POLICY_STATE_CLOSED);

        (, , , , , , , uint256 finalBuybackofferId, ) = policy.getTrancheInfo(0);
        assertEq(finalBuybackofferId, 0);
        (, , , , , , , finalBuybackofferId, ) = policy.getTrancheInfo(1);
        assertEq(finalBuybackofferId, 0);
    }

    function testPayTranchePremiumAfterMaturationDateWithPendingClaims() public {
        weth.deposit{ value: 20 }();
        weth.approve(address(policy), 20);
        policy.payTranchePremium(0, 10);
        policy.payTranchePremium(1, 10);

        vm.warp(1000); // initiation date

        policy.checkAndUpdateState();

        weth.deposit{ value: 540 }();
        weth.approve(address(policy), 540);
        policy.payTranchePremium(0, 270);
        policy.payTranchePremium(1, 270);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        vm.startPrank(insuredPartyRep);
        policy.makeClaim(0, 1);
        policy.makeClaim(0, 2);
        vm.stopPrank();

        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 state, ) = policy.getInfo();
        assertEq(state, POLICY_STATE_MATURED);

        vm.startPrank(claimsAdminRep);
        policy.declineClaim(0);
        policy.declineClaim(1);

        policy.checkAndUpdateState();

        (, , , , , , , state, ) = policy.getInfo();
        assertEq(state, POLICY_STATE_CLOSED);
    }
}

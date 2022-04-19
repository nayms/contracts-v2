// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./utils/DSTestPlusF.sol";
import "./utils/users/MockAccounts.sol";

import {IACLConstants} from "../../contracts/base/IACLConstants.sol";
import {ISettingsKeys} from "../../contracts/base/ISettingsKeys.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from "../../contracts/Settings.sol";
import {AccessControl} from "../../contracts/base/AccessControl.sol";
import {ISettings} from "../../contracts/base/ISettings.sol";

import {IMarketFeeSchedules} from "../../contracts/base/IMarketFeeSchedules.sol";
import {IMarketDataFacet} from "../../contracts/base/IMarketDataFacet.sol";
import {IMarket} from "../../contracts/base/IMarket.sol";
import {Market} from "../../contracts/Market.sol";
import {MarketCoreFacet} from "../../contracts/MarketCoreFacet.sol";
import {MarketDataFacet} from "../../contracts/MarketDataFacet.sol";

import {EntityDeployer} from "../../contracts/EntityDeployer.sol";

import {FeeBankCoreFacet} from "../../contracts/FeeBankCoreFacet.sol";

import {FeeBank} from "../../contracts/FeeBank.sol";

import {IPolicyStates} from "../../contracts/base/IPolicyStates.sol";
import {IPolicyTypes} from "../../contracts/base/IPolicyTypes.sol";
import {IPolicy} from "../../contracts/base/IPolicy.sol";
import {ISimplePolicy2} from "../../contracts/base/ISimplePolicy2.sol";
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
import {Entity} from "../../contracts/Entity.sol";

import {DummyEntityFacet} from "../../contracts/test/DummyEntityFacet.sol";
import {EntityTreasuryTestFacet} from "../../contracts/test/EntityTreasuryTestFacet.sol";
import {IEntityTreasuryTestFacet} from "../../contracts/test/EntityTreasuryTestFacet.sol";

import {DummyToken} from "../../contracts/DummyToken.sol";

import {CommonUpgradeFacet} from "../../contracts/CommonUpgradeFacet.sol";

import {FreezeUpgradesFacet} from "../../contracts/test/FreezeUpgradesFacet.sol";

import {IDiamondProxy} from "../../contracts/base/IDiamondProxy.sol";
import {Strings} from "../../contracts/base/Strings.sol";
import {Address} from "../../contracts/base/Address.sol";

interface IProxy {
    function getDelegateAddress() external view returns (address);
}

/// @notice test entityAddress

contract IntegrationSPVTest is DSTestPlusF, MockAccounts, IACLConstants, ISettingsKeys, IMarketFeeSchedules, IPolicyStates, IPolicyTypes {
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

    IPolicy internal policy;

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

    EntityTreasuryTestFacet internal entityTreasuryTestFacet;

    IEntity internal entity;
    IEntity internal underwriter;
    IEntity internal insuredParty;
    IEntity internal broker;
    IEntity internal claimsAdmin;

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

        marketProxy = new Market(address(settings));
        vm.label(address(marketProxy), "Market Proxy Diamond");

        market = IMarket(address(marketProxy));

        // market proxy diamond
        settings.setAddress(address(settings), SETTING_MARKET, address(marketProxy));

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

        entityTreasuryTestFacet = new EntityTreasuryTestFacet();

        address[] memory entityFacetAddys = new address[](10);
        entityFacetAddys[0] = address(entityCoreFacet);
        entityFacetAddys[1] = address(entityFundingFacet);
        entityFacetAddys[2] = address(entityTokensFacet);
        entityFacetAddys[3] = address(entityDividendsFacet);
        entityFacetAddys[4] = address(entityTreasuryFacet);
        entityFacetAddys[5] = address(entityTreasuryBridgeFacet);
        entityFacetAddys[6] = address(entitySimplePolicyCoreFacet);
        entityFacetAddys[7] = address(entitySimplePolicyDataFacet);
        entityFacetAddys[8] = address(commonUpgradeFacet);
        entityFacetAddys[9] = address(entityTreasuryTestFacet);
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
        uint256 brokerCommissionBP = 200;
        uint256 underwriterCommissionBP = 300;
        uint256 claimsAdminCommissionBP = 100; // 1%
        uint256 naymsCommissionBP = 300;

        initiationDateDiff = 1000;
        startDateDiff = 2000;
        maturationDateDiff = 4000;

        uint256[] memory types = new uint256[](8);
        // policy type
        types[0] = POLICY_TYPE_SPV;
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
        premiumsDiff[1] = 1000;
        premiumsDiff[2] = 500 + 1000;
        premiumsDiff[3] = 2000;
        premiumsDiff[4] = 1000 + 1000;
        premiumsDiff[5] = 3000;
        premiumsDiff[6] = 1500 + 1000;
        premiumsDiff[7] = 4000;
        premiumsDiff[8] = 2000 + 1000;
        premiumsDiff[9] = 5000;
        premiumsDiff[10] = 2500 + 1000;
        premiumsDiff[11] = 6000;
        premiumsDiff[12] = 3000 + 1000;
        premiumsDiff[13] = 7000;
        policy.createTranche(numShares, pricePerShareAmount, premiumsDiff);

        numShares = 50;
        pricePerShareAmount = 2;
        policy.createTranche(numShares, pricePerShareAmount, premiumsDiff);

        acl.assignRole(entity.aclContext(), underwriterRep, ROLE_ENTITY_REP);
        acl.assignRole(entity.aclContext(), insuredPartyRep, ROLE_ENTITY_REP);
        acl.assignRole(entity.aclContext(), brokerRep, ROLE_ENTITY_REP);
        acl.assignRole(entity.aclContext(), claimsAdminRep, ROLE_ENTITY_REP);
        // vm.prank(underwriterRep);
        // policy.approve(ROLE_PENDING_UNDERWRITER);
        // vm.prank(insuredPartyRep);
        // policy.approve(ROLE_PENDING_INSURED_PARTY);
        // vm.prank(brokerRep);
        // policy.approve(ROLE_PENDING_BROKER);
        // vm.prank(claimsAdminRep);
        // policy.approve(ROLE_PENDING_CLAIMS_ADMIN);

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

    function testSPVPolicyCreated() public {
        policy.checkAndUpdateState();
        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_CREATED);
    }

    function testSPVPolicyCanceled() public {
        vm.warp(1000);
        policy.checkAndUpdateState();
        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_CANCELLED);
    }

    function testSPVPolicyApproved() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(2, 1000);

        vm.warp(1000); // initiation date

        policy.checkAndUpdateState();
        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);
        assertEq(initialSaleOfferId, 0);

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_APPROVED);
    }

    function testSPVPayTranchePremium() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date

        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);
        assertEq(initialSaleOfferId, 0);
        (, , , , , , initialSaleOfferId, , ) = policy.getTrancheInfo(1);
        assertEq(initialSaleOfferId, 0);

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        IERC20 tt0 = IERC20(trancheToken0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);
        IERC20 tt1 = IERC20(trancheToken1);
        assertEq(tt0.balanceOf(address(market)), 0);
        assertEq(tt1.balanceOf(address(market)), 0);
        assertEq(tt0.balanceOf(address(entityAddress)), 100);
        assertEq(tt1.balanceOf(address(entityAddress)), 50);
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_INITIATED);
        assertEq(tt0.balanceOf(address(market)), 100);
        assertEq(tt1.balanceOf(address(market)), 50);
        assertEq(tt0.balanceOf(address(entityAddress)), 0);
        assertEq(tt1.balanceOf(address(entityAddress)), 0);

        (, , , , , , initialSaleOfferId, , ) = policy.getTrancheInfo(0);
        assertEq(initialSaleOfferId, 1);
        (, , , , , , initialSaleOfferId, , ) = policy.getTrancheInfo(1);
        assertEq(initialSaleOfferId, 2);
    }

    function testSPVPlatformActionFeeSchedule() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date

        vm.prank(underwriterRep);
        vm.expectRevert("must be in active state");
        policy.makeClaim(0, 1);

        policy.checkAndUpdateState();
        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);

        IMarketDataFacet.OfferState memory firstOffer = market.getOffer(initialSaleOfferId);

        assertEq(firstOffer.feeSchedule, FEE_SCHEDULE_PLATFORM_ACTION);

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_INITIATED);

        (, uint256 trancheState, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState, TRANCHE_STATE_SELLING);

        (, , , , , uint256 sharesSold, , , ) = policy.getTrancheInfo(0);
        assertEq(sharesSold, 0);
    }

    function testSPVTrancheSelling() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_INITIATED);

        (, , , , , uint256 sharesSold, , , ) = policy.getTrancheInfo(0);
        assertEq(sharesSold, 0);

        (, , , , , sharesSold, , , ) = policy.getTrancheInfo(1);
        assertEq(sharesSold, 0);

        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);

        vm.deal(account2, 25);
        vm.prank(account2);
        weth.deposit{value: 25}();

        vm.prank(insuredPartyRep);
        vm.expectRevert("must be in active state");
        policy.makeClaim(0, 1);

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        IERC20 tt0 = IERC20(trancheToken0);

        assertEq(weth.balanceOf(account2), 25);
        assertEq(weth.balanceOf(address(policy)), 180);
        assertEq(weth.balanceOf(address(entity)), 1820);
        assertEq(weth.balanceOf(address(market)), 0);
        assertEq(tt0.balanceOf(address(account2)), 0);
        assertEq(tt0.balanceOf(address(entity)), 0);
        assertEq(tt0.balanceOf(address(market)), 100);

        vm.startPrank(account2);
        weth.approve(address(market), 10);
        market.executeLimitOffer(address(weth), 10, address(trancheToken0), 5000, FEE_SCHEDULE_STANDARD, address(0), "");

        assertEq(weth.balanceOf(account2), 15);
        assertEq(weth.balanceOf(address(policy)), 180);
        assertEq(weth.balanceOf(address(entity)), 1820);
        assertEq(weth.balanceOf(address(market)), 10);
        assertEq(tt0.balanceOf(address(account2)), 0);
        assertEq(tt0.balanceOf(address(entityAddress)), 0);
        assertEq(tt0.balanceOf(address(market)), 100);

        // and tranche status is unchanged
        (, uint256 trancheState, , , , uint256 sharesSold0, uint256 initialSaleOfferId0, , ) = policy.getTrancheInfo(0);
        assertEq(trancheState, TRANCHE_STATE_SELLING);

        // and tranche balance is unchanged
        // todo
        // uint256 calcBal = (1000 * 10_000) / 900; // premium amount
        // assertEq(balance, calcBal);

        // and the tally of shares sold is unchanged
        assertEq(sharesSold0, 0);

        // and market offer is still active
        assertTrue(market.isActive(initialSaleOfferId0));
    }

    function testSPVTranchePartialFills() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_INITIATED);

        (, , , , , uint256 sharesSold, , , ) = policy.getTrancheInfo(0);
        assertEq(sharesSold, 0);

        (, , , , , sharesSold, , , ) = policy.getTrancheInfo(1);
        assertEq(sharesSold, 0);

        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);

        vm.deal(account2, 25);
        vm.prank(account2);
        weth.deposit{value: 25}();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        IERC20 tt0 = IERC20(trancheToken0);

        assertEq(weth.balanceOf(account2), 25);
        assertEq(weth.balanceOf(address(policy)), 180);
        assertEq(weth.balanceOf(address(entity)), 1820);
        assertEq(weth.balanceOf(address(market)), 0);
        assertEq(tt0.balanceOf(address(account2)), 0);
        assertEq(tt0.balanceOf(address(entity)), 0);
        assertEq(tt0.balanceOf(address(market)), 100);

        vm.startPrank(account2);
        weth.approve(address(market), 10);
        market.executeLimitOffer(address(weth), 4, address(trancheToken0), 2, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 6, address(trancheToken0), 3, FEE_SCHEDULE_STANDARD, address(0), "");

        assertEq(weth.balanceOf(account2), 15);
        assertEq(weth.balanceOf(address(policy)), 180);
        assertEq(weth.balanceOf(address(entity)), 1820 + 10);
        assertEq(weth.balanceOf(address(market)), 0);
        assertEq(tt0.balanceOf(address(account2)), 5);
        assertEq(tt0.balanceOf(address(entityAddress)), 0);
        assertEq(tt0.balanceOf(address(market)), 95);

        // and tranche status is unchanged
        (, uint256 trancheState, , , , uint256 sharesSold0, uint256 initialSaleOfferId0, , ) = policy.getTrancheInfo(0);
        assertEq(trancheState, TRANCHE_STATE_SELLING);

        // and tranche balance has been updated
        // todo
        // uint256 calcBal = (1000 * 10_000) / 900; // premium amount
        // assertEq(balance, calcBal);

        // and the tally of shares sold has been updated
        assertEq(sharesSold0, 5);

        // and market offer is still active
        assertTrue(market.isActive(initialSaleOfferId0));
    }

    // new token owners cannot trade their tokens whilst tranche is still selling
    // todo

    function testSPVTrancheFullySellsOut() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_INITIATED);

        (, , , , , uint256 sharesSold, , , ) = policy.getTrancheInfo(0);
        assertEq(sharesSold, 0);

        (, , , , , sharesSold, , , ) = policy.getTrancheInfo(1);
        assertEq(sharesSold, 0);

        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);

        vm.deal(account2, 25);
        vm.prank(account2);
        weth.deposit{value: 25}();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);

        vm.startPrank(account2);
        vm.deal(account2, 200);
        weth.deposit{value: 200}();
        weth.approve(address(market), 200);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");

        // then its status is set to active
        (, uint256 trancheState, , , , uint256 sharesSold0, uint256 initialSaleOfferId0, , ) = policy.getTrancheInfo(0);
        assertEq(trancheState, TRANCHE_STATE_ACTIVE);

        // and tranche balance has been updated
        // todo
        // uint256 calcBal = (1000 * 10_000) / 900; // premium amount
        // assertEq(balance, calcBal);

        // and the tally of shares sold has been updated
        assertEq(sharesSold0, 100);

        // and market offer is closed
        if (market.isActive(initialSaleOfferId0)) fail();
    }

    function testSPVTrancheTokensSupportERC20() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_INITIATED);

        (, , , , , uint256 sharesSold, , , ) = policy.getTrancheInfo(0);
        assertEq(sharesSold, 0);

        (, , , , , sharesSold, , , ) = policy.getTrancheInfo(1);
        assertEq(sharesSold, 0);

        (, , , , , , uint256 initialSaleOfferId, , ) = policy.getTrancheInfo(0);

        vm.deal(account2, 25);
        vm.startPrank(account2);
        weth.deposit{value: 25}();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        IERC20 tt0 = IERC20(trancheToken0);

        vm.deal(account2, 200);
        weth.deposit{value: 200}();
        weth.approve(address(market), 200);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");

        vm.expectRevert("only nayms market is allowed to transfer");
        tt0.transfer(account3, 1);

        vm.expectRevert("only nayms market is allowed to transfer");
        tt0.approve(account3, 1);

        tt0.approve(address(market), 1);
        vm.stopPrank();

        vm.startPrank(address(market));
        vm.expectRevert("not enough balance");
        tt0.transferFrom(account2, account5, 100 + 1);

        // tt0.balanceOf(address(market));
        // tt0.balanceOf(address(account2));
        tt0.transferFrom(account2, account5, 100);

        assertEq(tt0.balanceOf(address(account2)), 0);
        assertEq(tt0.balanceOf(address(account5)), 100);
    }

    function testSPVTrancheSaleEnded() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_INITIATED);

        // vm.deal(account2, 1000000);
        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 2000);
        policy.payTranchePremium(1, 2000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        // todo check events

        (, , , , , , uint256 initialSaleOfferId0, , ) = policy.getTrancheInfo(0);
        (, , , , , , uint256 initialSaleOfferId1, , ) = policy.getTrancheInfo(1);
        assertEq(initialSaleOfferId0, 1);
        assertEq(initialSaleOfferId1, 2);

        if (market.isActive(initialSaleOfferId0)) fail();
        if (market.isActive(initialSaleOfferId1)) fail();

        // even if none of the tranches are active the policy still gets made active
        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_ACTIVE);

        (, uint256 trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_CANCELLED);
        (, uint256 trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
    }

    function testSPVTrancheNotActive() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 2000);
        policy.payTranchePremium(1, 2000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        // even if none of the tranches are active the policy still gets made active
        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);

        vm.deal(account2, 1000000);
        weth.deposit{value: 1000000}();
        weth.approve(address(market), 200);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");

        (, uint256 trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_CANCELLED);
        (, uint256 trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
    }

    function testSPVTrancheNotActive2() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 2000);
        policy.payTranchePremium(1, 2000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);

        vm.startPrank(account2);
        vm.deal(account2, 1000000);
        weth.deposit{value: 1000000}();
        weth.approve(address(market), 200);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");

        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 3000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        // atleast one of the tranches can be active and its premiums can be up-to-date, in which case it stays active

        (, , , , , , , uint256 policyState, ) = policy.getInfo();
        assertEq(policyState, POLICY_STATE_ACTIVE);

        (, uint256 trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_ACTIVE);
        (, uint256 trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
    }

    function testSPVTrancheNotActive3() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 2000);
        policy.payTranchePremium(1, 2000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        IERC20 tt0 = IERC20(trancheToken0);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 200);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");

        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 3000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        market.executeLimitOffer(address(trancheToken0), 1, address(weth), 1, FEE_SCHEDULE_STANDARD, address(0), "");

        assertEq(tt0.balanceOf(address(account2)), 99);
    }

    // if policy has been active for a while state can be checked again
    function testSPVCheckPolicyState() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_ACTIVE);

        (, uint256 trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_ACTIVE);
        (, uint256 trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_ACTIVE);

        // and it remains active if all premium payments are up to date
        policy.payTranchePremium(0, 7000 + 1000);
        policy.payTranchePremium(1, 7000 + 1000);

        vm.warp(2000 + 500); // start date
        policy.checkAndUpdateState();

        (, , , , , , , policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_ACTIVE);

        (, trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_ACTIVE);
        (, trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_ACTIVE);
    }

    // and it still stays active if any tranche premium payments have been missed, though that tranche gets cancelled
    function testSPVCheckPolicyState2() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_ACTIVE);

        (, uint256 trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_ACTIVE);
        (, uint256 trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_ACTIVE);

        // and it remains active if all premium payments are up to date
        policy.payTranchePremium(0, 7000 + 1000);
        // policy.payTranchePremium(1, 7000 + 1000);

        vm.warp(2000 + 500); // start date
        policy.checkAndUpdateState();

        (, , , , , , , policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_ACTIVE);

        (, trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_ACTIVE);
        (, trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
    }

    function testSPVMakeClaim() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        policy.payTranchePremium(0, 8000);
        policy.payTranchePremium(1, 8000);

        vm.warp(2000 + 500); // start date
        policy.checkAndUpdateState();

        vm.startPrank(insuredPartyRep);
        policy.makeClaim(0, 1);
        policy.makeClaim(0, 2);
        policy.makeClaim(1, 4);
        policy.makeClaim(1, 7);
        vm.stopPrank();

        // they can then be approved or declined
        vm.prank(claimsAdminRep);
        policy.declineClaim(0);
        vm.prank(insuredPartyRep);
        policy.makeClaim(0, 1);
        vm.prank(claimsAdminRep);
        policy.approveClaim(1);
    }

    function testSPVPayTranchePremiumAfterStartDate() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        policy.payTranchePremium(0, 8000);
        policy.payTranchePremium(1, 8000);

        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        // todo check events

        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_BUYBACK);

        (, uint256 trancheState0, , , , , , uint256 finalBuybackofferId0, ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_CANCELLED);
        assertEq(finalBuybackofferId0, 3);
        (, uint256 trancheState1, , , , , , uint256 finalBuybackofferId1, ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
        assertEq(finalBuybackofferId1, 4);
    }

    function testSPVPayTranchePremiumAfterMaturationDateWithPendingClaims() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        policy.payTranchePremium(0, 8000);
        policy.payTranchePremium(1, 8000);

        vm.startPrank(insuredPartyRep);
        policy.makeClaim(0, 1);
        policy.makeClaim(0, 2);
        vm.stopPrank();

        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        // todo test events

        // it does not do the buyback until the claims get handled
        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_MATURED);

        (, uint256 trancheState0, , , , , , uint256 finalBuybackofferId0, ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_CANCELLED);
        assertEq(finalBuybackofferId0, 0);
        (, uint256 trancheState1, , , , , , uint256 finalBuybackofferId1, ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
        assertEq(finalBuybackofferId1, 0);
    }

    // but if the policy is not fully collateralized in the treasury
    function testSPVUnderCollateralized() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        policy.payTranchePremium(0, 8000);
        policy.payTranchePremium(1, 8000);

        IEntityTreasuryTestFacet entityTreasuryTestFacet = IEntityTreasuryTestFacet(entityAddress);
        entityTreasuryTestFacet.setRealBalance(address(weth), 0);

        // it does not do the buyback until policy becomes collateralized again

        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_MATURED);

        (, uint256 trancheState0, , , , , , uint256 finalBuybackofferId0, ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_CANCELLED);
        assertEq(finalBuybackofferId0, 0);
        (, uint256 trancheState1, , , , , , uint256 finalBuybackofferId1, ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
        assertEq(finalBuybackofferId1, 0);

        entityTreasuryTestFacet.setRealBalance(address(weth), 10e5);
        policy.checkAndUpdateState();

        // todo check events
    }

    // and subsequent calls have no effect
    function testSPVTrancheInBuybackSubsequentCalls() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        policy.payTranchePremium(0, 8000);
        policy.payTranchePremium(1, 8000);

        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_BUYBACK);

        (, , , , , , , uint256 finalBuybackofferId0, ) = policy.getTrancheInfo(0);
        assertEq(finalBuybackofferId0, 3);

        (, , , , , , , uint256 finalBuybackofferId1, ) = policy.getTrancheInfo(1);
        assertEq(finalBuybackofferId1, 4);

        // IEntityTreasuryTestFacet entityTreasuryTestFacet = IEntityTreasuryTestFacet(entityAddress);
        // entityTreasuryTestFacet.setRealBalance(address(weth), 0);
        IEntityTreasuryTestFacet(address(entity)).setRealBalance(address(weth), 10e5);

        // policy.checkAndUpdateState();

        (, uint256 trancheState0, , , , , , , ) = policy.getTrancheInfo(0);
        assertEq(trancheState0, TRANCHE_STATE_CANCELLED);

        (, uint256 trancheState1, , , , , , , ) = policy.getTrancheInfo(1);
        assertEq(trancheState1, TRANCHE_STATE_CANCELLED);

        policy.getClaimStats();
        // it does not do the buyback until policy becomes collateralized again

        // (, uint256 trancheState0, , , , , , uint256 finalBuybackofferId0, ) = policy.getTrancheInfo(0);
        // assertEq(trancheState0, TRANCHE_STATE_CANCELLED);
        // assertEq(finalBuybackofferId0, 0);
        // (, uint256 trancheState1, , , , , , uint256 finalBuybackofferId1, ) = policy.getTrancheInfo(1);
        // assertEq(trancheState1, TRANCHE_STATE_CANCELLED);
        // assertEq(finalBuybackofferId1, 0);

        //         entityTreasuryTestFacet.setRealBalance(address(weth), 10e5);
        // policy.checkAndUpdateState();

        // todo check events
    }

    function testSPVBuybackAllTokens() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        policy.payTranchePremium(0, 8000);
        policy.payTranchePremium(1, 8000);

        (uint256 numPremiums, uint256 nextPremiumAmount, , , , uint256 numPremiumsPaid) = policy.getTranchePremiumsInfo(0);

        uint256 toPay;
        for (uint256 i = numPremiumsPaid + 1; numPremiums >= i; i++) {
            toPay += nextPremiumAmount;
            nextPremiumAmount += 1000;
        }

        policy.payTranchePremium(1, toPay);
        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        // the market offer uses the "platform action" fee schedule
        (, , uint256 numShares, , , , , uint256 finalBuybackOfferId0, bool buybackCompleted) = policy.getTrancheInfo(0);
        IMarketDataFacet.OfferState memory offerState = market.getOffer(finalBuybackOfferId0);

        assertEq(offerState.feeSchedule, FEE_SCHEDULE_PLATFORM_ACTION);

        IERC20 tt0 = IERC20(trancheToken0);

        // keeps track of when a tranche has been totally bought back
        assertEq(tt0.balanceOf(address(entity)), 0);

        if (buybackCompleted) fail();

        vm.prank(account2);
        market.executeMarketOffer(trancheToken0, offerState.buyAmount, address(weth));

        assertEq(tt0.balanceOf(address(entity)), numShares);

        (, , , , , , , , buybackCompleted) = policy.getTrancheInfo(0);
        assertTrue(buybackCompleted);
    }

    function testSPVBuybackAllTokensAndPolicyStateClosed() public {
        vm.prank(underwriterRep);
        policy.approve(ROLE_PENDING_UNDERWRITER);
        vm.prank(insuredPartyRep);
        policy.approve(ROLE_PENDING_INSURED_PARTY);
        vm.prank(brokerRep);
        policy.approve(ROLE_PENDING_BROKER);
        vm.prank(claimsAdminRep);
        policy.approve(ROLE_PENDING_CLAIMS_ADMIN);
        weth.deposit{value: 100000}();
        weth.approve(address(policy), 100000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        weth.deposit{value: 1000000}();
        weth.approve(address(policy), 1000000);
        policy.payTranchePremium(0, 1000);
        policy.payTranchePremium(1, 1000);

        vm.warp(1000); // initiation date
        policy.checkAndUpdateState();

        (address trancheToken0, , , , , , , , ) = policy.getTrancheInfo(0);
        (address trancheToken1, , , , , , , , ) = policy.getTrancheInfo(1);

        vm.startPrank(account2);
        vm.deal(account2, 2000000);
        weth.deposit{value: 2000000}();
        weth.approve(address(market), 2000000);
        market.executeLimitOffer(address(weth), 200, address(trancheToken0), 100, FEE_SCHEDULE_STANDARD, address(0), "");
        market.executeLimitOffer(address(weth), 100, address(trancheToken1), 50, FEE_SCHEDULE_STANDARD, address(0), "");
        vm.stopPrank();

        // todo calculate premium to pay
        policy.payTranchePremium(0, 7000);
        policy.payTranchePremium(1, 7000);

        vm.warp(2000); // start date
        policy.checkAndUpdateState();

        policy.payTranchePremium(0, 8000);
        policy.payTranchePremium(1, 8000);

        (uint256 numPremiums, uint256 nextPremiumAmount, , , , uint256 numPremiumsPaid) = policy.getTranchePremiumsInfo(0);

        uint256 toPay;
        for (uint256 i = numPremiumsPaid + 1; numPremiums >= i; i++) {
            toPay += nextPremiumAmount;
            nextPremiumAmount += 1000;
        }

        policy.payTranchePremium(1, toPay);
        vm.warp(4000); // maturation date
        policy.checkAndUpdateState();

        // the market offer uses the "platform action" fee schedule
        (, , uint256 numShares, , , , , uint256 finalBuybackOfferId0, bool buybackCompleted) = policy.getTrancheInfo(0);
        IMarketDataFacet.OfferState memory offerState = market.getOffer(finalBuybackOfferId0);

        assertEq(offerState.feeSchedule, FEE_SCHEDULE_PLATFORM_ACTION);

        IERC20 tt0 = IERC20(trancheToken0);

        // keeps track of when a tranche has been totally bought back
        assertEq(tt0.balanceOf(address(entity)), 0);

        if (buybackCompleted) fail();

        vm.prank(account2);
        market.executeMarketOffer(trancheToken0, offerState.buyAmount, address(weth));

        assertEq(tt0.balanceOf(address(entity)), numShares);

        (, , , , , , , , buybackCompleted) = policy.getTrancheInfo(0);
        assertTrue(buybackCompleted);

        (, , , , , , , uint256 policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_BUYBACK);

        (, , , , , , , uint256 finalBuybackOfferId1, bool buybackCompleted1) = policy.getTrancheInfo(1);
        if (buybackCompleted1) fail();

        IMarketDataFacet.OfferState memory offerState1 = market.getOffer(finalBuybackOfferId1);

        vm.prank(account2);
        market.executeMarketOffer(trancheToken1, offerState1.buyAmount, address(weth));

        (, , , , , , , , buybackCompleted1) = policy.getTrancheInfo(1);
        assertTrue(buybackCompleted1);

        (, , , , , , , policyState0, ) = policy.getInfo();
        assertEq(policyState0, POLICY_STATE_CLOSED);
    }
}

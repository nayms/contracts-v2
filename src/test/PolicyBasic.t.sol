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
import { IMarket } from "../../contracts/base/IMarket.sol";
import { Market } from "../../contracts/Market.sol";
import { MarketCoreFacet } from "../../contracts/MarketCoreFacet.sol";
import { MarketDataFacet } from "../../contracts/MarketDataFacet.sol";

import { EntityDeployer } from "../../contracts/EntityDeployer.sol";

import { FeeBankCoreFacet } from "../../contracts/FeeBankCoreFacet.sol";

import { FeeBank } from "../../contracts/FeeBank.sol";

import { IPolicyStates } from "../../contracts/base/IPolicyStates.sol";
import { IPolicyTypes } from "../../contracts/base/IPolicyTypes.sol";
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

import { DummyEntityFacet } from "../../contracts/test/DummyEntityFacet.sol";

import { DummyToken } from "../../contracts/DummyToken.sol";

import { CommonUpgradeFacet } from "../../contracts/CommonUpgradeFacet.sol";

import { FreezeUpgradesFacet } from "../../contracts/test/FreezeUpgradesFacet.sol";

import { IDiamondProxy } from "../../contracts/base/IDiamondProxy.sol";

struct PolicyInfo {
    uint256 initiationDateDiff;
    uint256 startDateDiff;
    uint256 maturationDateDiff;
    uint256 brokerCommissionBP;
    uint256 underwriterCommissionBP;
    uint256 claimsAdminCommissionBP;
    uint256 naymsCommissionBP;
}

contract PolicyBasicTest is DSTestPlusF, MockAccounts, IACLConstants, ISettingsKeys, IMarketFeeSchedules, IPolicyStates, IPolicyTypes {
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

    DummyToken internal weth;
    DummyToken internal wethTrue;

    bytes32 internal entityContext;
    address internal entityAddress;

    IEntity internal entity;

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

        entityContext = systemContext;
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

    function testBasicPolicy() public {
        entityDeployer.deploy(insuredPartyRep, entityContext);
        entityDeployer.deploy(brokerRep, entityContext);
        entityDeployer.deploy(claimsAdminRep, entityContext);
        entityDeployer.deploy(underwriterRep, entityContext);

        IEntity(entity).updateAllowPolicy(true);

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

        address insuredParty = entityDeployer.getChild(2);
        address broker = entityDeployer.getChild(3);
        address claimsAdmin = entityDeployer.getChild(4);
        address underwriter = entityDeployer.getChild(5);

        address[] memory addresses = new address[](6);
        // policy premium currency address
        addresses[0] = address(0);
        // treasury address
        addresses[1] = entityAddress;
        // broker entity address
        addresses[2] = broker;
        // underwriter entity address
        addresses[3] = address(underwriter);
        // claims admin entity address
        addresses[4] = claimsAdmin;
        // insured party entity address
        addresses[5] = insuredParty;

        uint256[][] memory trancheData = new uint256[][](1);

        uint256[] memory innerTrancheData = new uint256[](4);
        innerTrancheData[0] = 100; // num shares
        innerTrancheData[1] = 1; // price per share amount
        innerTrancheData[2] = 1100;
        innerTrancheData[3] = 20;

        trancheData[0] = innerTrancheData;
        bytes[] memory approvalSignatures = new bytes[](0);

        bytes32 policyId = "0x1";
        acl.assignRole(entity.aclContext(), underwriterRep, ROLE_ENTITY_REP);
        // acl.assignRole(entity.aclContext(), insuredPartyRep, ROLE_ENTITY_REP);
        acl.assignRole(entity.aclContext(), brokerRep, ROLE_ENTITY_REP);
        // acl.assignRole(entity.aclContext(), claimsAdminRep, ROLE_ENTITY_REP);

        vm.prank(brokerRep);
        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);

        vm.prank(underwriterRep);
        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);

        vm.expectRevert("must be broker or underwriter");
        vm.prank(claimsAdminRep);
        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);

        vm.expectRevert("must be broker or underwriter");
        vm.prank(insuredPartyRep);
        entity.createPolicy(policyId, types, addresses, trancheData, approvalSignatures);

        entity.updateAllowPolicy(false);
    }
}

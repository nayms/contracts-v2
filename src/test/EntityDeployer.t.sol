// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./utils/DSTestPlusF.sol";

import {IACLConstants} from "../../contracts/base/IACLConstants.sol";
import {ISettingsKeys} from "../../contracts/base/ISettingsKeys.sol";
// import {AccessControl} from "../../contracts/base/AccessControl.sol";
import {ACL} from "../../contracts/ACL.sol";
import {Settings} from "../../contracts/Settings.sol";
import {ISettings} from "../../contracts/base/ISettings.sol";

import {IEntityDeployer} from "../../contracts/base/IEntityDeployer.sol";
import {IEntity} from "../../contracts/base/IEntity.sol";
import {EntityDeployer} from "../../contracts/EntityDeployer.sol";
import {EntityDelegate} from "../../contracts/EntityDelegate.sol";
import {EntityCoreFacet} from "../../contracts/EntityCoreFacet.sol";
import {EntityFundingFacet} from "../../contracts/EntityFundingFacet.sol";
import {EntityTokensFacet} from "../../contracts/EntityTokensFacet.sol";
import {EntityDividendsFacet} from "../../contracts/EntityDividendsFacet.sol";
import {EntityTreasuryFacet} from "../../contracts/EntityTreasuryFacet.sol";
import {EntityTreasuryBridgeFacet} from "../../contracts/EntityTreasuryBridgeFacet.sol";
import {EntitySimplePolicyCoreFacet} from "../../contracts/EntitySimplePolicyCoreFacet.sol";
import {EntitySimplePolicyDataFacet} from "../../contracts/EntitySimplePolicyDataFacet.sol";

contract EntityDeployerTest is DSTestPlusF, IACLConstants, ISettingsKeys {
    ACL internal acl;
    Settings internal settings;
    // AccessControl internal accessControl;
    bytes32 internal systemContext;

    EntityCoreFacet internal entityCoreFacet;
    EntityFundingFacet internal entityFundingFacet;
    EntityTokensFacet internal entityTokensFacet;
    EntityDividendsFacet internal entityDividendsFacet;
    EntityTreasuryFacet internal entityTreasuryFacet;
    EntityTreasuryBridgeFacet internal entityTreasuryBridgeFacet;
    EntitySimplePolicyCoreFacet internal entitySimplePolicyCoreFacet;
    EntitySimplePolicyDataFacet internal entitySimplePolicyDataFacet;

    EntityDelegate internal entityDelegate;
    EntityDeployer internal entityDeployer;

    event NewEntity(address indexed entity, address indexed deployer);

    function setUp() public {
        acl = new ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        settings = new Settings(address(acl));
        // accessControl = new AccessControl(address(settings));
        systemContext = acl.systemContext();

        // setup role groups
        // bytes32[] memory roles = new bytes32[](1);
        // roles[0] = ROLE_SYSTEM_MANAGER;
        // acl.setRoleGroup(ROLEGROUP_SYSTEM_MANAGERS, roles);

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
        rg6[0] = ROLE_INSURED_PARTY;
        acl.setRoleGroup(ROLEGROUP_INSURED_PARTYS, rg6);
        bytes32[] memory rg7 = new bytes32[](1);
        rg7[0] = ROLE_CLAIMS_ADMIN;
        acl.setRoleGroup(ROLEGROUP_CLAIMS_ADMINS, rg7);

        bytes32[] memory rg8 = new bytes32[](1);
        rg8[0] = ROLE_ENTITY_ADMIN;
        acl.setRoleGroup(ROLEGROUP_ENTITY_ADMINS, rg8);
        bytes32[] memory rg9 = new bytes32[](2);
        rg9[0] = ROLE_ENTITY_ADMIN;
        rg9[1] = ROLE_ENTITY_MANAGER;
        acl.setRoleGroup(ROLEGROUP_ENTITY_MANAGERS, rg9);

        bytes32[] memory rg10 = new bytes32[](3);
        rg10[0] = ROLE_ENTITY_ADMIN;
        rg10[1] = ROLE_ENTITY_MANAGER;
        rg10[2] = ROLE_ENTITY_REP;
        acl.setRoleGroup(ROLEGROUP_ENTITY_REPS, rg10);

        bytes32[] memory rg11 = new bytes32[](1);
        rg11[0] = ROLE_POLICY_OWNER;
        acl.setRoleGroup(ROLEGROUP_POLICY_OWNERS, rg11);
        bytes32[] memory rg12 = new bytes32[](1);
        rg12[0] = ROLE_SYSTEM_MANAGER;
        acl.setRoleGroup(ROLEGROUP_SYSTEM_MANAGERS, rg12);
        bytes32[] memory rg13 = new bytes32[](1);
        rg13[0] = ROLE_ENTITY_REP;
        acl.setRoleGroup(ROLEGROUP_TRADERS, rg13);

        acl.addAssigner(ROLE_APPROVED_USER, ROLEGROUP_SYSTEM_MANAGERS);
        acl.addAssigner(ROLE_UNDERWRITER, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_CAPITAL_PROVIDER, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_BROKER, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_INSURED_PARTY, ROLEGROUP_POLICY_OWNERS);
        acl.addAssigner(ROLE_ENTITY_ADMIN, ROLEGROUP_SYSTEM_ADMINS);
        acl.addAssigner(ROLE_ENTITY_MANAGER, ROLEGROUP_ENTITY_ADMINS);
        acl.addAssigner(ROLE_ENTITY_REP, ROLEGROUP_ENTITY_ADMINS);
        acl.addAssigner(ROLE_ENTITY_REP, ROLEGROUP_SYSTEM_MANAGERS);
        acl.addAssigner(ROLE_SYSTEM_MANAGER, ROLEGROUP_SYSTEM_ADMINS);

        entityCoreFacet = new EntityCoreFacet(address(settings));
        entityFundingFacet = new EntityFundingFacet(address(settings));
        entityTokensFacet = new EntityTokensFacet(address(settings));
        entityDividendsFacet = new EntityDividendsFacet(address(settings));
        entityTreasuryFacet = new EntityTreasuryFacet(address(settings));
        entityTreasuryBridgeFacet = new EntityTreasuryBridgeFacet(address(settings));
        entitySimplePolicyCoreFacet = new EntitySimplePolicyCoreFacet(address(settings));
        entitySimplePolicyDataFacet = new EntitySimplePolicyDataFacet(address(settings));

        address[] memory entityFacetAddys = new address[](8);
        entityFacetAddys[0] = address(entityCoreFacet);
        entityFacetAddys[1] = address(entityFundingFacet);
        entityFacetAddys[2] = address(entityTokensFacet);
        entityFacetAddys[3] = address(entityDividendsFacet);
        entityFacetAddys[4] = address(entityTreasuryFacet);
        entityFacetAddys[5] = address(entityTreasuryBridgeFacet);
        entityFacetAddys[6] = address(entitySimplePolicyCoreFacet);
        entityFacetAddys[7] = address(entitySimplePolicyDataFacet);

        vm.label(address(acl), "ACL");
        vm.label(address(settings), "Settings");

        vm.label(address(entityCoreFacet), "Entity Core Facet");
        vm.label(address(entityFundingFacet), "Entity Funding Facet");
        vm.label(address(entityTokensFacet), "Entity Tokens Facet");
        vm.label(address(entityDividendsFacet), "Entity Dividends Facet");
        vm.label(address(entityTreasuryFacet), "Entity Treasury Facet");
        vm.label(address(entityTreasuryBridgeFacet), "Entity Treasury Bridge Facet");
        vm.label(address(entitySimplePolicyCoreFacet), "Entity Simple Policy Core Facet");
        vm.label(address(entitySimplePolicyDataFacet), "Entity Simple Policy Data Facet");
        settings.setAddresses(address(settings), SETTING_ENTITY_IMPL, entityFacetAddys); // entity facets

        entityDelegate = new EntityDelegate(address(settings));
        vm.label(address(entityDelegate), "Entity Delegate");
        settings.setAddress(address(settings), SETTING_ENTITY_DELEGATE, address(entityDelegate));
        entityDeployer = new EntityDeployer(address(settings));
        vm.label(address(entityDeployer), "Entity Deployer");
        settings.setAddress(address(settings), SETTING_ENTITY_DEPLOYER, address(entityDeployer));
    }

    function testEntityDeployerCannotReceiveEth() public {
        (bool sent, bytes memory data) = address(entityDeployer).call{value: 1}("");
        if (!sent) emit log_named_bytes32("Failed to send Ether", bytes32(data));
        // require(sent, "Failed to send Ether");
    }

    function testEntityDeployerIsDestructable() public {
        entityDeployer.destroy();

        enforceHasContractCode(address(entityDeployer), "Failed to destroy");
    }

    function testEntityDeployerIsNotDestructableByNonAdmin() public {
        vm.expectRevert("must be admin");
        vm.prank(address(0xBEEF));
        entityDeployer.destroy();

        enforceHasContractCode(address(entityDeployer), "Failed to destroy");
    }

    function testEntityDeployerDeploy() public {
        // by an admin
        // vm.expectEmit(true, true, false, false);
        // emit NewEntity(address(0x11), msg.sender);
        // entityDeployer.deploy(address(0xBEEF), "");

        console.logBytes32(acl.generateContextFromAddress(address(this)));
        console.logBytes32(acl.generateContextFromAddress(address(entityDeployer)));

        // by a system manager
        acl.assignRole(systemContext, address(0xBEEF), ROLE_SYSTEM_MANAGER);

        vm.prank(address(0xBEEF));
        entityDeployer.deploy(address(0xBEEF), "");
    }

    // and the entity records get updated accordingly
    function testEntityDeployerState() public {
        assertEq(entityDeployer.getNumChildren(), 0);

        bytes32 aclContext = entityDeployer.aclContext();
        console.logBytes32(aclContext);

        acl.assignRole(acl.systemContext(), address(0xBEEF), ROLE_SYSTEM_MANAGER);

        vm.prank(address(0xBEEF));
        entityDeployer.deploy(address(0xBEEF), "");

        assertEq(entityDeployer.getNumChildren(), 1);

        address newEntity = entityDeployer.getChild(1);
        assertTrue(entityDeployer.hasChild(newEntity));

        assertEq(IEntity(newEntity).getParent(), address(entityDeployer));

        vm.prank(address(0xBEEF));
        entityDeployer.deploy(address(0xBEEF), "");

        assertEq(entityDeployer.getNumChildren(), 2);
        address newEntity2 = entityDeployer.getChild(2);
        assertTrue(entityDeployer.hasChild(newEntity2));
        assertEq(IEntity(newEntity2).getParent(), address(entityDeployer));

        // vm.prank(address(newEntity));
        assertEq(IEntity(newEntity).aclContext(), systemContext);
    }
}

// when deploying an entity through the entity deployer, if the role groups are not setup,
// there will be issues

// AccessControl.inRoleGroup() -> inRoleGroupWithContext() -> acl().hasRoleInGroup() ->
// ACL.hasAnyRole() ->  aclContext()

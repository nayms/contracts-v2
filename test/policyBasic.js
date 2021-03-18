import { keccak256, asciiToHex } from './utils/web3'

import {
  extractEventArgs,
  hdWallet,
  preSetupPolicy,
  createEntity,
  createPolicy,
  EvmSnapshot,
} from './utils'
import { events } from '../'

import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'

import { ensureAclIsDeployed } from '../migrations/modules/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IERC20 = artifacts.require("./base/IERC20")
const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./base/IPolicy")
const TestPolicyFacet = artifacts.require("./test/TestPolicyFacet")
const FreezeUpgradesFacet = artifacts.require("./test/FreezeUpgradesFacet")

const POLICY_ATTRS_1 = {
  initiationDateDiff: 1000,
  startDateDiff: 2000,
  maturationDateDiff: 3000,
  premiumIntervalSeconds: undefined,
  claimsAdminCommissionBP: 0,
  brokerCommissionBP: 0,
  naymsCommissionBP: 0
}

const POLICY_ATTRS_2 = Object.assign({}, POLICY_ATTRS_1, {
  premiumIntervalSeconds: 5,
  claimsAdminCommissionBP: 1,
  brokerCommissionBP: 2,
  naymsCommissionBP: 3
})


contract('Policy: Basic', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let systemContext
  let settings
  let entityDeployer
  let entityProxy
  let entity
  let entityContext
  let policyProxy
  let policy
  let policyCoreAddress
  let policyContext
  let policyOwnerAddress
  let market
  let etherToken

  const entityAdminAddress = accounts[1]
  const entityManagerAddress = accounts[2]

  let POLICY_STATE_CREATED
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED

  let TRANCH_STATE_CANCELLED
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED

  const policies = new Map()
  let setupPolicy

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // market
    market = await ensureMarketIsDeployed({ artifacts, settings })

    // registry + wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts, settings })

    // entity
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings, entityDeployer })

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const entityAddress = await createEntity({ entityDeployer, adminAddress: entityAdminAddress })

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(systemContext, entityManagerAddress, ROLES.APPROVED_USER)
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER, { from: entityAdminAddress })

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts, settings }))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()

    const preSetupPolicyCtx = { policies, settings, events, etherToken, entity, entityManagerAddress }
    await Promise.all([
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_1),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_2),
    ])

    setupPolicy = async arg => {
      const { attrs, policyAddress } = policies.get(arg)

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicy.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress

      return attrs
    }
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('basic tests', () => {
    it('must be created by broker or underwriter', async () => {
      const underwriterRep = entityAdminAddress
      const insuredPartyRep = accounts[7]
      const brokerRep = accounts[8]
      const claimsAdminRep = accounts[9]

      const insuredParty = await createEntity({ entityDeployer, adminAddress: insuredPartyRep })
      const broker = await createEntity({ entityDeployer, adminAddress: brokerRep })
      const claimsAdmin = await createEntity({ entityDeployer, adminAddress: claimsAdminRep })

      const attrs = Object.assign({}, POLICY_ATTRS_1, {
        underwriter: entity.address, 
        insuredParty, 
        broker, 
        claimsAdmin
      })

      await createPolicy(entity, attrs, { from: underwriterRep }).should.eventually.be.fulfilled
      await createPolicy(entity, attrs, { from: brokerRep }).should.eventually.be.fulfilled
      await createPolicy(entity, attrs, { from: claimsAdminRep }).should.be.rejectedWith('must be broker or underwriter')
      await createPolicy(entity, attrs, { from: insuredPartyRep }).should.be.rejectedWith('must be broker or underwriter')
    })

    it('can return its basic info', async () => {
      const attrs = await setupPolicy(POLICY_ATTRS_2)

      await policy.getInfo().should.eventually.matchObj({
        treasury_: entity.address,
        initiationDate_: attrs.initiationDate,
        startDate_: attrs.startDate,
        maturationDate_: attrs.maturationDate,
        unit_: attrs.unit,
        premiumIntervalSeconds_: 5,
        claimsAdminCommissionBP_: 1,
        brokerCommissionBP_: 2,
        naymsCommissionBP_: 3,
        numTranches_: 0,
        state_: POLICY_STATE_CREATED
      })
    })
  })

  describe('it can be upgraded', async () => {
    let testPolicyFacet
    let freezeUpgradesFacet

    beforeEach(async () => {
      await setupPolicy(POLICY_ATTRS_1)

      // deploy new implementation
      testPolicyFacet = await TestPolicyFacet.new()
      freezeUpgradesFacet = await FreezeUpgradesFacet.new()
    })

    it('and returns version info', async () => {
      const versionInfo = await policy.getVersionInfo()
      expect(versionInfo.num_).to.exist
      expect(versionInfo.date_).to.exist
      expect(versionInfo.hash_).to.exist
    })

    it('but not just by anyone', async () => {
      await policy.upgrade([ testPolicyFacet.address ], { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('but not to the existing implementation', async () => {
      await policy.upgrade([ policyCoreAddress ]).should.be.rejectedWith('Adding functions failed')
    })

    it('and points to the new implementation', async () => {
      await policy.upgrade([testPolicyFacet.address]).should.be.fulfilled
      await policy.calculateMaxNumOfPremiums().should.eventually.eq(666);
    })

    it('and can be frozen', async () => {
      await policy.upgrade([freezeUpgradesFacet.address]).should.be.fulfilled
      await policy.upgrade([testPolicyFacet.address]).should.be.rejectedWith('frozen')
    })

    it('and the internal upgrade function cannot be called directly', async () => {
      const proxy = await IDiamondProxy.at(policy.address)
      await proxy.registerFacets([]).should.be.rejectedWith('external caller not allowed')
    })
  })
})

import { keccak256, asciiToHex } from './utils/web3'

import {
  extractEventArgs,
  hdWallet,
  preSetupPolicy,
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
  capitalProviderCommissionBP: 0,
  brokerCommissionBP: 0,
  naymsCommissionBP: 0
}

const POLICY_ATTRS_2 = Object.assign({}, POLICY_ATTRS_1, {
  premiumIntervalSeconds: 5,
  capitalProviderCommissionBP: 1,
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
  let entityManagerAddress
  let policyOwnerAddress
  let market
  let etherToken

  let POLICY_STATE_CREATED
  let POLICY_STATE_SELLING
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
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    // market
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)

    // registry + wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, settings.address)

    // entity
    await ensureEntityImplementationsAreDeployed({ artifacts }, settings.address)
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts }, settings.address)

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_ADMIN)
    await acl.assignRole(entityContext, accounts[2], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[2]

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts }, settings.address))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_SELLING = await policyStates.POLICY_STATE_SELLING()
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
    it('can return its basic info', async () => {
      const attrs = await setupPolicy(POLICY_ATTRS_2)

      await policy.getInfo().should.eventually.matchObj({
        initiationDate_: attrs.initiationDate,
        startDate_: attrs.startDate,
        maturationDate_: attrs.maturationDate,
        unit_: attrs.unit,
        premiumIntervalSeconds_: 5,
        capitalProviderCommissionBP_: 1,
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

      // assign roles
      await acl.assignRole(policyContext, accounts[3], ROLES.CAPITAL_PROVIDER)
      await acl.assignRole(policyContext, accounts[4], ROLES.INSURED_PARTY)

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

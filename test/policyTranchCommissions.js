
import { keccak256, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
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
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./base/IPolicy")

const POLICY_ATTRS_1 = {
  initiationDateDiff: 1000,
  startDateDiff: 2000,
  maturationDateDiff: 3000,
  premiumIntervalSeconds: 30,
  capitalProviderCommissionBP: 1,
  brokerCommissionBP: 2,
  naymsCommissionBP: 3
}

contract('Policy Tranches: Commissions', accounts => {
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

  let capitalProvider
  let insuredParty
  let broker

  let POLICY_STATE_CREATED
  let POLICY_STATE_SELLING
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED

  let TRANCH_STATE_CANCELLED
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED

  let setupPolicy
  const policies = new Map()

  const tranchNumShares = 10
  const tranchPricePerShare = 100

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
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_ADMIN)
    await acl.assignRole(entityContext, accounts[2], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[2]

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts, settings }))

    capitalProvider = accounts[6]
    insuredParty = accounts[7]
    broker = accounts[8]
    Object.assign(POLICY_ATTRS_1, { capitalProvider, insuredParty, broker })

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
    ])

    setupPolicy = async arg => {
      const { attrs, policyAddress } = policies.get(arg)

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

  describe('commissions', () => {
    beforeEach(async () => {
      await setupPolicy(POLICY_ATTRS_1)

      await createTranch(policy, {
        premiums: [2000, 3000, 4000]
      }, { from: policyOwnerAddress })

      await policy.approve({ from: capitalProvider })
      await policy.approve({ from: insuredParty })
      await policy.approve({ from: broker })
    })

    it('updates the balances correctly as premiums get paid in', async () => {
      await etherToken.deposit({ value: 10000 })
      await etherToken.approve(policy.address, 10000)

      await policy.payTranchPremium(0, 2000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        capitalProviderCommissionBalance_: 2, /* 0.1% of 2000 */
        brokerCommissionBalance_: 4, /* 0.2% of 2000 */
        naymsCommissionBalance_: 6, /* 0.3% of 2000 */
      })

      await policy.getTranchInfo(0).should.eventually.matchObj({
        balance_: 1988, /* 2000 - (2 + 4 + 6) */
      })

      await policy.payTranchPremium(0, 3000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        capitalProviderCommissionBalance_: 5, /* 2 + 3 (=0.1% of 3000) */
        brokerCommissionBalance_: 10, /* 4 + 6 (=0.2% of 3000) */
        naymsCommissionBalance_: 15, /* 6 + 9 (=0.3% of 3000) */
      })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        balance_: 4970, /* 1988 + 3000 - (3 + 6 + 9) */
      })

      await policy.payTranchPremium(0, 4000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        capitalProviderCommissionBalance_: 9, /* 5 + 4 (=0.1% of 4000) */
        brokerCommissionBalance_: 18, /* 10 + 8 (=0.2% of 4000) */
        naymsCommissionBalance_: 27, /* 15 + 12 (=0.3% of 4000) */
      })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        balance_: 8946, /* 4970 + 4000 - (4 + 8 + 12) */
      })
    })

    it('updates the balances correctly for batch premium payments too', async () => {
      await etherToken.deposit({ value: 10000 })
      await etherToken.approve(policy.address, 10000)

      await policy.payTranchPremium(0, 4000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        capitalProviderCommissionBalance_: 4, /* 0.1% of 4000 */
        brokerCommissionBalance_: 8, /* 0.2% of 4000 */
        naymsCommissionBalance_: 12, /* 0.3% of 4000 */
      })

      await policy.getTranchInfo(0).should.eventually.matchObj({
        balance_: 3976, /* 4000 - (4 + 8 + 12) */
      })
    })

    describe('and the commissions can be paid out', async () => {
      beforeEach(async () => {
        await etherToken.deposit({ value: 10000 })
        await etherToken.approve(policy.address, 10000)

        await policy.payTranchPremium(0, 5000)

        // assign roles
        await acl.assignRole(policyContext, accounts[5], ROLES.CAPITAL_PROVIDER)
        await acl.assignRole(policyContext, accounts[6], ROLES.BROKER)

        // assign to entities
        await acl.assignRole(entityContext, accounts[5], ROLES.ENTITY_REP)
        await acl.assignRole(entityContext, accounts[6], ROLES.ENTITY_REP)
      })

      it('but not if invalid capital provider entity gets passed in', async () => {
        await policy.payCommissions(accounts[1], accounts[5], entity.address, accounts[6]).should.be.rejectedWith('revert')
      })

      it('but not if invalid broker entity gets passed in', async () => {
        await policy.payCommissions(entity.address, accounts[5], accounts[1], accounts[6]).should.be.rejectedWith('revert')
      })

      it('but not if invalid capital provider gets passed in', async () => {
        await policy.payCommissions(entity.address, accounts[7], entity.address, accounts[6]).should.be.rejectedWith('must be capital provider')
      })

      it('but not if invalid broker gets passed in', async () => {
        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[7]).should.be.rejectedWith('must be broker')
      })

      it('but not if capital provider does not belong to entity', async () => {
        await acl.unassignRole(entityContext, accounts[5], ROLES.ENTITY_REP)
        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6]).should.be.rejectedWith('must have role in capital provider entity')
      })

      it('but not if broker does not belong to entity', async () => {
        await acl.unassignRole(entityContext, accounts[6], ROLES.ENTITY_REP)
        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6]).should.be.rejectedWith('must have role in broker entity')
      })

      it('and emits an event', async () => {
        const ret = await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

        expect(extractEventArgs(ret, events.PaidCommissions)).to.include({
          capitalProviderEntity: entity.address,
          brokerEntity: entity.address
        })
      })

      it('and gets transferred', async () => {
        const preBalance = (await etherToken.balanceOf(entity.address)).toNumber()

        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

        const postBalance = (await etherToken.balanceOf(entity.address)).toNumber()

        expect(postBalance - preBalance).to.eq(5 + 10)

        const naymsEntityAddress = await settings.getRootAddress(SETTINGS.NAYMS_ENTITY)
        const naymsEntityBalance = (await etherToken.balanceOf(naymsEntityAddress)).toNumber()

        expect(naymsEntityBalance).to.eq(15)
      })

      it('and updates internal balance values', async () => {
        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])
        await policy.getCommissionBalances().should.eventually.matchObj({
          capitalProviderCommissionBalance_: 0,
          brokerCommissionBalance_: 0,
          naymsCommissionBalance_: 0,
        })
      })

      it('and allows multiple calls', async () => {
        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])
        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

        await policy.payTranchPremium(0, 4000)

        await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

        const naymsEntityAddress = await settings.getRootAddress(SETTINGS.NAYMS_ENTITY)
        const naymsEntityBalance = (await etherToken.balanceOf(naymsEntityAddress)).toNumber()
        expect(naymsEntityBalance).to.eq(27)

        await policy.getCommissionBalances().should.eventually.matchObj({
          capitalProviderCommissionBalance_: 0,
          brokerCommissionBalance_: 0,
          naymsCommissionBalance_: 0,
        })
      })
    })
  })
})

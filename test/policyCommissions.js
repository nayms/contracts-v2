
import { keccak256, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
  createEntity,
  preSetupPolicy,
  EvmSnapshot,
} from './utils'
import { events } from '..'

import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'

import { ensureAclIsDeployed } from '../migrations/modules/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureFeeBankIsDeployed } from '../migrations/modules/feeBank'
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
  claimsAdminCommissionBP: 1,
  brokerCommissionBP: 2,
  naymsCommissionBP: 3
}

contract('Policy: Commissions', accounts => {
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
  let feeBank
  let etherToken

  const entityAdminAddress = accounts[0]
  const entityManagerAddress = accounts[1]
  const insuredPartyRep = accounts[4]
  const underwriterRep = accounts[5]
  const brokerRep = accounts[6]
  const claimsAdminRep = accounts[7]

  let insuredParty
  let underwriter
  let broker
  let claimsAdmin

  let POLICY_STATE_CREATED
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let POLICY_STATE_APPROVED

  let TRANCH_STATE_CANCELLED
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED

  let setupPolicy
  let approvePolicy
  const policies = new Map()

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // market
    market = await ensureMarketIsDeployed({ artifacts, settings })

    // fee bank
    feeBank = await ensureFeeBankIsDeployed({ artifacts, settings })

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
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER, { from: entityAdminAddress })

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts, settings }))

    // roles
    underwriter = await createEntity({ entityDeployer, adminAddress: underwriterRep, entityContext, acl })
    insuredParty = await createEntity({ entityDeployer, adminAddress: insuredPartyRep })
    broker = await createEntity({ entityDeployer, adminAddress: brokerRep })
    claimsAdmin = await createEntity({ entityDeployer, adminAddress: claimsAdminRep })
    Object.assign(POLICY_ATTRS_1, { underwriter, insuredParty, broker, claimsAdmin })

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()
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

    approvePolicy = async () => {
      await policy.markAsReadyForApproval({ from: policyOwnerAddress })
      await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
      await policy.approve(ROLES.PENDING_CLAIMS_ADMIN, { from: claimsAdminRep })
      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_APPROVED
      })
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
    })

    it('updates the balances correctly as premiums get paid in', async () => {
      await etherToken.deposit({ value: 10000 })
      await etherToken.approve(policy.address, 10000)

      await policy.payTranchPremium(0, 2000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        claimsAdminCommissionBalance_: 2, /* 0.1% of 2000 */
        brokerCommissionBalance_: 4, /* 0.2% of 2000 */
        naymsCommissionBalance_: 6, /* 0.3% of 2000 */
      })

      await policy.getTranchInfo(0).should.eventually.matchObj({
        balance_: 1988, /* 2000 - (2 + 4 + 6) */
      })

      await policy.payTranchPremium(0, 3000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        claimsAdminCommissionBalance_: 5, /* 2 + 3 (=0.1% of 3000) */
        brokerCommissionBalance_: 10, /* 4 + 6 (=0.2% of 3000) */
        naymsCommissionBalance_: 15, /* 6 + 9 (=0.3% of 3000) */
      })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        balance_: 4970, /* 1988 + 3000 - (3 + 6 + 9) */
      })

      await policy.payTranchPremium(0, 4000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        claimsAdminCommissionBalance_: 9, /* 5 + 4 (=0.1% of 4000) */
        brokerCommissionBalance_: 18, /* 10 + 8 (=0.2% of 4000) */
        naymsCommissionBalance_: 27, /* 15 + 12 (=0.3% of 4000) */
      })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        balance_: 8946, /* 4970 + 4000 - (4 + 8 + 12) */
      })

      // check balances
      await etherToken.balanceOf(entity.address).should.eventually.eq(8946)
      await etherToken.balanceOf(policy.address).should.eventually.eq(9 + 18 + 27)
    })

    it('updates the balances correctly for batch premium payments too', async () => {
      await etherToken.deposit({ value: 10000 })
      await etherToken.approve(policy.address, 10000)

      await policy.payTranchPremium(0, 4000)

      await policy.getCommissionBalances().should.eventually.matchObj({
        claimsAdminCommissionBalance_: 4, /* 0.1% of 4000 */
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
      })

      it('not if policy not yet approved', async () => {
        await policy.payCommissions().should.be.rejectedWith('must be approved')

        await policy.markAsReadyForApproval({ from: policyOwnerAddress })
        await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })

        await policy.payCommissions().should.be.rejectedWith('must be approved')
      })

      describe('if policy has been approved', () => {
        beforeEach(async () => {
          await approvePolicy()
        })

        it('and emits an event', async () => {
          const ret = await policy.payCommissions()

          expect(extractEventArgs(ret, events.PaidCommissions)).to.include({
            claimsAdmin,
            broker,
          })
        })

        it('and funds get transferred', async () => {
          await policy.payTranchPremium(0, 5000)

          const preBalance1 = (await etherToken.balanceOf(claimsAdmin)).toNumber()
          const preBalance2 = (await etherToken.balanceOf(broker)).toNumber()

          await policy.payCommissions()

          const postBalance1 = (await etherToken.balanceOf(claimsAdmin)).toNumber()
          const postBalance2 = (await etherToken.balanceOf(broker)).toNumber()

          expect(postBalance1 - preBalance1).to.eq(5)
          expect(postBalance2 - preBalance2).to.eq(10)

          const feeBankBalance = (await etherToken.balanceOf(feeBank.address)).toNumber()
          expect(feeBankBalance).to.eq(15)
        })

        it('and updates internal balance values', async () => {
          await policy.payCommissions()
          await policy.getCommissionBalances().should.eventually.matchObj({
            claimsAdminCommissionBalance_: 0,
            brokerCommissionBalance_: 0,
            naymsCommissionBalance_: 0,
          })
        })

        it('and allows multiple calls', async () => {
          await policy.payCommissions()
          await policy.payCommissions()

          await policy.payTranchPremium(0, 4000)

          await policy.payCommissions()

          const feeBankBalance = (await etherToken.balanceOf(feeBank.address)).toNumber()
          expect(feeBankBalance).to.eq(12)

          await policy.getCommissionBalances().should.eventually.matchObj({
            claimsAdminCommissionBalance_: 0,
            brokerCommissionBalance_: 0,
            naymsCommissionBalance_: 0,
          })
        })
      })
    })
  })
})

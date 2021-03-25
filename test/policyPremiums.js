
import { keccak256, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
  preSetupPolicy,
  EvmClock,
  createEntity,
  EvmSnapshot,
} from './utils'
import { events } from '..'

import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'

import { ensureAclIsDeployed } from '../migrations/modules/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IERC20 = artifacts.require("./base/IERC20")
const IPolicyTreasury = artifacts.require('./base/IPolicyTreasury')
const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./base/IPolicy")
const TestPolicyFacet = artifacts.require("./test/TestPolicyFacet")
const FreezeUpgradesFacet = artifacts.require("./test/FreezeUpgradesFacet")

const premiumIntervalSeconds = 30

const POLICY_ATTRS_1 = {
  initiationDateDiff: 1000,
  startDateDiff: 2000,
  maturationDateDiff: 3000,
  premiumIntervalSeconds,
  claimsAdminCommissionBP: 0,
  brokerCommissionBP: 0,
  naymsCommissionBP: 0,
}

const POLICY_ATTRS_2 = Object.assign({}, POLICY_ATTRS_1, {
  initiationDateDiff: 0,
  startDateDiff: 2000,
  maturationDateDiff: 3000,
})

const POLICY_ATTRS_3 = Object.assign({}, POLICY_ATTRS_1, {
  initiationDateDiff: 1000,
  startDateDiff: 3000,
  maturationDateDiff: 6000,
  premiumIntervalSeconds: 5000,
})

contract('Policy: Premiums', accounts => {
  const evmSnapshot = new EvmSnapshot()
  let evmClock

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
  const insuredPartyRep = accounts[4]
  const underwriterRep = accounts[5]
  const brokerRep = accounts[6]
  const claimsAdminRep = accounts[7]

  let insuredParty
  let underwriter
  let broker
  let claimsAdmin

  let treasury

  let POLICY_STATE_CREATED
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let POLICY_STATE_IN_APPROVAL
  let POLICY_STATE_APPROVED
  let POLICY_STATE_CANCELLED

  let TRANCH_STATE_CANCELLED
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED

  let approvePolicy
  let setupPolicy
  const policies = new Map()

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

    treasury = await IPolicyTreasury.at(entityAddress)

    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER)

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts, settings }))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_CANCELLED = await policyStates.POLICY_STATE_CANCELLED()
    POLICY_STATE_IN_APPROVAL = await policyStates.POLICY_STATE_IN_APPROVAL()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()

    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()

    // roles
    underwriter = await createEntity({ entityDeployer, adminAddress: underwriterRep, entityContext, acl })
    insuredParty = await createEntity({ entityDeployer, adminAddress: insuredPartyRep })
    broker = await createEntity({ entityDeployer, adminAddress: brokerRep })
    claimsAdmin = await createEntity({ entityDeployer, adminAddress: claimsAdminRep })

    Object.assign(POLICY_ATTRS_1, { underwriter, insuredParty, broker, claimsAdmin })
    Object.assign(POLICY_ATTRS_2, { underwriter, insuredParty, broker, claimsAdmin })
    Object.assign(POLICY_ATTRS_3, { underwriter, insuredParty, broker, claimsAdmin })

    const preSetupPolicyCtx = { policies, settings, events, etherToken, entity, entityManagerAddress }
    await Promise.all([
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_1),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_2),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_3),
    ])

    setupPolicy = async arg => {
      const { attrs, baseTime, policyAddress } = policies.get(arg)

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicy.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress

      evmClock = new EvmClock(baseTime)

      return attrs
    }

    approvePolicy = async () => {
      await policy.markAsReadyForApproval({ from: policyOwnerAddress })
      await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
      await policy.approve(ROLES.PENDING_CLAIMS_ADMIN, { from: claimsAdminRep })
    }
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('premiums', () => {
    describe('basic tests', () => {
      let policyAttrs

      beforeEach(async () => {
        policyAttrs = await setupPolicy(POLICY_ATTRS_1)
      })

      it('empty premiums array is allowed', async () => {
        await createTranch(policy, {
          premiums: []
        }, { from: policyOwnerAddress })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 0,
          nextPremiumAmount_: 0,
          nextPremiumDueAt_: 0,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })
      })

      it('initially the first premium is expected by the inititation date', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 3,
          nextPremiumAmount_: 2,
          nextPremiumDueAt_: policyAttrs.initiationDate,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })
      })

      it('policy must have permission to transfer premium payment token', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 10 })
        await policy.payTranchPremium(0, 2).should.be.rejectedWith('amount exceeds allowance')
      })

      it('sender must have enough tokens to make the payment', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 1 })
        await etherToken.approve(policy.address, 2)
        await policy.payTranchPremium(0, 2).should.be.rejectedWith('amount exceeds balance')
      })

      it('updates balances upon payment', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 2 })
        await etherToken.approve(policy.address, 2)

        const payerPreBalance = await etherToken.balanceOf(accounts[0])
        const treasuryPreBalance = await etherToken.balanceOf(entity.address)

        const ret = await policy.payTranchPremium(0, 2)

        const payerPostBalance = await etherToken.balanceOf(accounts[0])
        const treasuryPostBalance = await etherToken.balanceOf(entity.address)

        expect(payerPreBalance.sub(payerPostBalance).toNumber()).to.eql(2)
        expect(treasuryPostBalance.sub(treasuryPreBalance).toNumber()).to.eql(2)
      })

      it('emits an event upon payment', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 2 })
        await etherToken.approve(policy.address, 2)
        const ret = await policy.payTranchPremium(0, 2)

        expect(extractEventArgs(ret, events.PremiumPayment)).to.include({
          tranchIndex: '0',
          amount: '2',
        })
      })

      it('updates the internal stats once first payment is made', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 2 })
        await etherToken.approve(policy.address, 2)
        await policy.payTranchPremium(0, 2).should.be.fulfilled

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 2,
        })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 3,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 1,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amount_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidSoFar_: 2,
        })

        await treasury.getPolicyEconomics(policy.address).should.eventually.matchObj({
          balance_: 2,
        })
      })

      it('updates the internal stats and treasury once subsequent payment is made', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 5 })
        await etherToken.approve(policy.address, 5)
        await policy.payTranchPremium(0, 2).should.be.fulfilled
        await policy.payTranchPremium(0, 3).should.be.fulfilled

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 5,
        })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 4,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 2,
        })

        await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
          amount_: 3,
          dueAt_: policyAttrs.initiationDate + 30,
          paidSoFar_: 3,
        })

        await treasury.getPolicyEconomics(policy.address).should.eventually.matchObj({
          balance_: 5,
        })
      })

      it('partial payments allowed', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 2 })
        await etherToken.approve(policy.address, 2)

        let ret = await policy.payTranchPremium(0, 1).should.be.fulfilled

        expect(extractEventArgs(ret, events.PremiumPayment)).to.include({
          tranchIndex: '0',
          amount: '1',
        })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 1,
        })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 2,
          nextPremiumPaidSoFar_: 1,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amount_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidSoFar_: 1,
        })

        ret = await policy.payTranchPremium(0, 1).should.be.fulfilled

        expect(extractEventArgs(ret, events.PremiumPayment)).to.include({
          tranchIndex: '0',
          amount: '1',
        })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 2,
        })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 3,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 1,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amount_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidSoFar_: 2,
        })

        await treasury.getPolicyEconomics(policy.address).should.eventually.matchObj({
          balance_: 2,
        })
      })

      it('overpayments allowed', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 3 })
        await etherToken.approve(policy.address, 3)

        let ret = await policy.payTranchPremium(0, 3).should.be.fulfilled

        expect(extractEventArgs(ret, events.PremiumPayment)).to.include({
          tranchIndex: '0',
          amount: '3',
        })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 3,
        })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 3,
          nextPremiumPaidSoFar_: 1,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 1,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amount_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidSoFar_: 2,
        })

        await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
          amount_: 3,
          dueAt_: policyAttrs.initiationDate + premiumIntervalSeconds,
          paidSoFar_: 1,
        })

        await treasury.getPolicyEconomics(policy.address).should.eventually.matchObj({
          balance_: 3,
        })
      })

      it('can overpay the entire thing in one go', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 20 })
        await etherToken.approve(policy.address, 20)

        let ret = await policy.payTranchPremium(0, 20).should.be.fulfilled

        expect(extractEventArgs(ret, events.PremiumPayment)).to.include({
          tranchIndex: '0',
          amount: '9',
        })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 9,
        })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 0,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 3,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amount_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidSoFar_: 2,
        })

        await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
          amount_: 3,
          dueAt_: policyAttrs.initiationDate + premiumIntervalSeconds,
          paidSoFar_: 3,
        })

        await policy.getTranchPremiumInfo(0, 2).should.eventually.matchObj({
          amount_: 4,
          dueAt_: policyAttrs.initiationDate + premiumIntervalSeconds * 2,
          paidSoFar_: 4,
        })

        await etherToken.balanceOf(entity.address).should.eventually.eq(9)
        await treasury.getPolicyEconomics(policy.address).should.eventually.matchObj({
          balance_: 9,
        })
      })
    })

    describe('0-values', () => {
      let policyAttrs

      beforeEach(async () => {
        policyAttrs = await setupPolicy(POLICY_ATTRS_1)
      })

      it('0-values are skipped over when it comes to the first payment', async () => {
        await createTranch(policy, {
          premiums: [0, 0, 0, 2, 3, 4]
        }, { from: policyOwnerAddress })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 3,
          nextPremiumAmount_: 2,
          nextPremiumDueAt_: policyAttrs.initiationDate + (30 * 3),
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })

        await etherToken.deposit({ value: 2 })
        await etherToken.approve(policy.address, 2)
        await policy.payTranchPremium(0, 2)

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 2,
        })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 3,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 1,
        })

        await treasury.getPolicyEconomics(policy.address).should.eventually.matchObj({
          balance_: 2,
        })
      })

      it('0-values are skipped over for subsequent payments too', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 0, 4, 0, 0, 5, 0]
        }, { from: policyOwnerAddress })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 4,
          nextPremiumAmount_: 2,
          nextPremiumDueAt_: policyAttrs.initiationDate,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amont_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
          amont_: 3,
          dueAt_: policyAttrs.initiationDate + 30,
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        await policy.getTranchPremiumInfo(0, 2).should.eventually.matchObj({
          amont_: 4,
          dueAt_: policyAttrs.initiationDate + (30 * 3),
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        await policy.getTranchPremiumInfo(0, 3).should.eventually.matchObj({
          amont_: 5,
          dueAt_: policyAttrs.initiationDate + (30 * 6),
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        // pay them all
        await etherToken.deposit({ value: 40 })
        await etherToken.approve(policy.address, 40)
        await policy.payTranchPremium(0, 2)
        await policy.payTranchPremium(0, 3)
        await policy.payTranchPremium(0, 4)
        await policy.payTranchPremium(0, 5)

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 4,
          nextPremiumAmount_: 0,
          nextPremiumDueAt_: 0,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 4,
        })
      })

      it('0-values are skipped over for bulk payments too', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 0, 4, 0, 0, 5, 0]
        }, { from: policyOwnerAddress })

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 4,
          nextPremiumAmount_: 2,
          nextPremiumDueAt_: policyAttrs.initiationDate,
          nextPremiumPaidSoFar_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amont_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
          amont_: 3,
          dueAt_: policyAttrs.initiationDate + 30,
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        await policy.getTranchPremiumInfo(0, 2).should.eventually.matchObj({
          amont_: 4,
          dueAt_: policyAttrs.initiationDate + (30 * 3),
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        await policy.getTranchPremiumInfo(0, 3).should.eventually.matchObj({
          amont_: 5,
          dueAt_: policyAttrs.initiationDate + (30 * 6),
          paidAt_: 0,
          paidBy_: ADDRESS_ZERO,
        })

        // pay them all
        await etherToken.deposit({ value: 40 })
        await etherToken.approve(policy.address, 40)
        await policy.payTranchPremium(0, 7)

        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 4,
          nextPremiumAmount_: 4,
          nextPremiumDueAt_: policyAttrs.initiationDate + (30 * 3),
          nextPremiumPaidSoFar_: 2,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 2,
        })

        await policy.getTranchPremiumInfo(0, 2).should.eventually.matchObj({
          amount_: 4,
          dueAt_: policyAttrs.initiationDate + (30 * 3),
          paidSoFar_: 2,
        })
      })
    })

    describe('before initiation date has passed', () => {
      let policyAttrs
      
      beforeEach(async () => {
        policyAttrs = await setupPolicy(POLICY_ATTRS_2)

        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await approvePolicy()
      })

      it('it requires first payment to have been made', async () => {
        await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
          premiumPaymentsMissed_: 1,
          nextPremiumAmount_: 2,
          nextPremiumPaidSoFar_: 0,
          numPremiumsPaid_: 0,
        })

        await etherToken.deposit({ value: 5 })
        await etherToken.approve(policy.address, 5)
        await policy.payTranchPremium(0, 2).should.be.rejectedWith('payment too late')
      })
    })

    it('if all premiums are paid before initiation that is ok', async () => {
      await setupPolicy(POLICY_ATTRS_1)

      await createTranch(policy, {
        premiums: [2, 3, 5]
      }, { from: policyOwnerAddress })

      await approvePolicy()

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0, 2).should.be.fulfilled // 2
      await policy.payTranchPremium(0, 3).should.be.fulfilled // 3
      await policy.payTranchPremium(0, 5).should.be.fulfilled // 5

      await policy.getTranchPremiumsInfo(0).should.eventually.matchObj({
        premiumPaymentsMissed_: 0,
        nextPremiumAmount_: 0,
        nextPremiumDueAt_: 0,
        nextPremiumPaidSoFar_: 0,
        numPremiumsPaid_: 3,
      })
    })

    it('will not accept extra payments', async () => {
      await setupPolicy(POLICY_ATTRS_1)

      await createTranch(policy, {
        premiums: [2, 3, 4, 5]
      }, { from: policyOwnerAddress })

      await approvePolicy()

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0, 2).should.be.fulfilled // 2
      await policy.payTranchPremium(0, 3).should.be.fulfilled // 3
      await policy.payTranchPremium(0, 4).should.be.fulfilled // 4
      await policy.payTranchPremium(0, 5).should.be.fulfilled // 5

      const bal = await etherToken.balanceOf(accounts[0])
      await policy.payTranchPremium(0, 1).should.be.fulfilled // shouldn't take any money
      await etherToken.balanceOf(accounts[0]).should.eventually.eq(bal)
    })

    describe('disallowed', () => {
      beforeEach(async () => {
        await setupPolicy(POLICY_ATTRS_3)

        await createTranch(policy, {
          premiums: [2, 3]
        }, { from: policyOwnerAddress })

        await approvePolicy()

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)

        // pay first premium
        await policy.payTranchPremium(0, 2).should.be.fulfilled

        // kick-off sale
        await evmClock.setRelativeTime(1000)
        await policy.checkAndUpdateState()
      })

      it('if tranch is already cancelled', async () => {
        // shift to start date
        await evmClock.setRelativeTime(3000)
        // should auto-call heartbeat in here
        await policy.payTranchPremium(0, 3).should.be.rejectedWith('payment not allowed')

        await policy.getTranchInfo(0).should.eventually.matchObj({
          _state: TRANCH_STATE_CANCELLED,
        })
      })

      it('if tranch has already matured', async () => {
        // pay second premium
        await policy.payTranchPremium(0, 3).should.be.fulfilled

        // shift to maturation date
        await evmClock.setRelativeTime(6000)

        // should auto-call heartbeat in here
        await policy.payTranchPremium(0, 1).should.be.rejectedWith('payment not allowed')

        await policy.getTranchInfo(0).should.eventually.matchObj({
          _state: TRANCH_STATE_MATURED,
        })
      })
    })
  })
})

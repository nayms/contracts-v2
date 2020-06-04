
import { keccak256, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
  createPolicy,
  EvmClock,
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

contract('Policy Tranches: Premiums', accounts => {
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

  let setupPolicy

  const tranchNumShares = 10
  const tranchPricePerShare = 100

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    // market
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)

    // registry + wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)

    // entity
    await ensureEntityImplementationsAreDeployed({ artifacts }, acl.address, settings.address)
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts }, acl.address, settings.address)

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

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_SELLING = await policyStates.POLICY_STATE_SELLING()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()

    setupPolicy = async ({
      initiationDateDiff = 1000,
      startDateDiff = 2000,
      maturationDateDiff = 3000,
      premiumIntervalSeconds = undefined,
      brokerCommissionBP = 0,
      assetManagerCommissionBP = 0,
      naymsCommissionBP = 0,
    } = {}) => {
      // get current evm time
      const t = await settings.getTime()
      const currentBlockTime = parseInt(t.toString(10), 10)

      const attrs = {
        initiationDate: currentBlockTime + initiationDateDiff,
        startDate: currentBlockTime + startDateDiff,
        maturationDate: currentBlockTime + maturationDateDiff,
        unit: etherToken.address,
        premiumIntervalSeconds,
        brokerCommissionBP,
        assetManagerCommissionBP,
        naymsCommissionBP,
      }

      const createPolicyTx = await createPolicy(entity, attrs, { from: entityManagerAddress })
      const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy

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

  describe('premiums', () => {
    describe('basic tests', () => {
      let policyAttrs

      beforeEach(async () => {
        policyAttrs = await setupPolicy()
      })

      it('empty premiums array is allowed', async () => {
        await createTranch(policy, {
          premiums: []
        }, { from: policyOwnerAddress })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          numPremiums_: 0,
          nextPremiumAmount_: 0,
          nextPremiumDueAt_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })
      })

      it('initially the first premium is expected by the inititation date', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          numPremiums_: 3,
          nextPremiumAmount_: 2,
          nextPremiumDueAt_: policyAttrs.initiationDate,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })
      })

      it('policy must have permission to receive premium payment token', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 10 })
        await policy.payTranchPremium(0).should.be.rejectedWith('amount exceeds allowance')
      })

      it('sender must have enough tokens to make the payment', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 1 })
        await etherToken.approve(policy.address, 2)
        await policy.payTranchPremium(0).should.be.rejectedWith('amount exceeds balance')
      })

      it('emits an event upon payment', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 2 })
        await etherToken.approve(policy.address, 2)
        const ret = await policy.payTranchPremium(0)

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
        await policy.payTranchPremium(0).should.be.fulfilled

        await policy.getTranchInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 3,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 1,
          balance_: 2,
        })

        await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
          amount_: 2,
          dueAt_: policyAttrs.initiationDate,
          paidBy_: accounts[0]
        })
      })

      it('updates the internal stats once subsequent payment is made', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 5 })
        await etherToken.approve(policy.address, 5)
        await policy.payTranchPremium(0).should.be.fulfilled
        await policy.payTranchPremium(0).should.be.fulfilled

        await policy.getTranchInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 4,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 2,
          balance_: 5,
        })

        await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
          amount_: 3,
          dueAt_: policyAttrs.initiationDate + 30,
          paidBy_: accounts[0]
        })
      })
    })

    describe('0-values', () => {
      let policyAttrs

      beforeEach(async () => {
        policyAttrs = await setupPolicy()
      })

      it('0-values are skipped over when it comes to the first payment', async () => {
        await createTranch(policy, {
          premiums: [0, 0, 0, 2, 3, 4]
        }, { from: policyOwnerAddress })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          numPremiums_: 3,
          nextPremiumAmount_: 2,
          nextPremiumDueAt_: policyAttrs.initiationDate + (30 * 3),
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 0,
        })

        await etherToken.deposit({ value: 2 })
        await etherToken.approve(policy.address, 2)
        await policy.payTranchPremium(0)

        await policy.getTranchInfo(0).should.eventually.matchObj({
          nextPremiumAmount_: 3,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 1,
          balance_: 2,
        })
      })

      it('0-values are skipped over for subsequent payments too', async () => {
        await createTranch(policy, {
          premiums: [2, 3, 0, 4, 0, 0, 5, 0]
        }, { from: policyOwnerAddress })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          numPremiums_: 4,
          nextPremiumAmount_: 2,
          nextPremiumDueAt_: policyAttrs.initiationDate,
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
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(0)

        await policy.getTranchInfo(0).should.eventually.matchObj({
          numPremiums_: 4,
          nextPremiumAmount_: 0,
          nextPremiumDueAt_: 0,
          premiumPaymentsMissed_: 0,
          numPremiumsPaid_: 4,
        })
      })
    })

    describe('before initiation date has passed', () => {
      let policyAttrs

      beforeEach(async () => {
        policyAttrs = await setupPolicy({ initiationDateDiff: 0, startDateDiff: 2000, maturationDateDiff: 3000 })

        await createTranch(policy, {
          premiums: [2, 3, 4]
        }, { from: policyOwnerAddress })
      })

      it('it requires first payment to have been made', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          premiumPaymentsMissed_: 1,
          nextPremiumAmount_: 2,
          numPremiumsPaid_: 0,
        })

        await etherToken.deposit({ value: 5 })
        await etherToken.approve(policy.address, 5)
        await policy.payTranchPremium(0).should.be.rejectedWith('payment too late')
      })
    })

    it('if all premiums are paid before initiation that is ok', async () => {
      await setupPolicy({ initiationDateDiff: 200, startDateDiff: 400, maturationDateDiff: 6000, premiumIntervalSeconds: 10 })

      await createTranch(policy, {
        premiums: [2, 3, 5]
      }, { from: policyOwnerAddress })

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0).should.be.fulfilled // 2
      await policy.payTranchPremium(0).should.be.fulfilled // 3
      await policy.payTranchPremium(0).should.be.fulfilled // 5

      await policy.getTranchInfo(0).should.eventually.matchObj({
        premiumPaymentsMissed_: 0,
        nextPremiumAmount_: 0,
        nextPremiumDueAt_: 0,
        numPremiumsPaid_: 3,
      })
    })

    it('will not accept extra payments', async () => {
      await setupPolicy({ initiationDateDiff: 100, startDateDiff: 200, maturationDateDiff: 2000, premiumIntervalSeconds: 10 })

      await createTranch(policy, {
        premiums: [2, 3, 4, 5]
      }, { from: policyOwnerAddress })

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0).should.be.fulfilled // 2
      await policy.payTranchPremium(0).should.be.fulfilled // 3
      await policy.payTranchPremium(0).should.be.fulfilled // 4
      await policy.payTranchPremium(0).should.be.fulfilled // 5

      await policy.payTranchPremium(0).should.be.rejectedWith('all payments already made')
    })

    describe('disallowed', () => {
      beforeEach(async () => {
        await setupPolicy({
          initiationDateDiff: 10,
          startDateDiff: 30,
          maturationDateDiff: 60,
          premiumIntervalSeconds: 50
        })

        await createTranch(policy, {
          premiums: [2, 3]
        }, { from: policyOwnerAddress })

        evmClock = new EvmClock()

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)

        // pay first premium
        await policy.payTranchPremium(0).should.be.fulfilled

        // kick-off sale
        await evmClock.setTime(10)
        await policy.checkAndUpdateState()
      })

      it('if tranch is already cancelled', async () => {
        // shift to start date
        await evmClock.setTime(30)
        // should auto-call heartbeat in here
        await policy.payTranchPremium(0).should.be.rejectedWith('payment not allowed')

        await policy.getTranchInfo(0).should.eventually.matchObj({
          _state: TRANCH_STATE_CANCELLED,
        })
      })

      it('if tranch has already matured', async () => {
        // pay second premium
        await policy.payTranchPremium(0).should.be.fulfilled

        // shift to maturation date
        await evmClock.setTime(60)

        // should auto-call heartbeat in here
        await policy.payTranchPremium(0).should.be.rejectedWith('payment not allowed')

        await policy.getTranchInfo(0).should.eventually.matchObj({
          _state: TRANCH_STATE_MATURED,
        })
      })
    })
  })
})

import {
  extractEventArgs,
  parseEvents,
  createTranch,
  createPolicy,
  EvmClock,
  calcPremiumsMinusCommissions,
  EvmSnapshot,
} from './utils'

import { events } from '../'
import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ROLES, ROLEGROUPS } from '../utils/constants'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./IPolicy")
const IERC20 = artifacts.require("./base/IERC20")

contract('Policy: Flow', accounts => {
  const evmSnapshot = new EvmSnapshot()

  const capitalProviderCommissionBP = 100
  const brokerCommissionBP = 200
  const naymsCommissionBP = 300

  let acl
  let systemContext
  let settings
  let policyProxy
  let policy
  let entity
  let premiumIntervalSeconds
  let baseDate
  let initiationDate
  let startDate
  let maturationDate
  let market
  let etherToken
  let entityManagerAddress
  let policyOwnerAddress

  let insuredParty
  let capitalProvider

  let POLICY_STATE_CREATED
  let POLICY_STATE_SELLING
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let TRANCH_STATE_CREATED
  let TRANCH_STATE_SELLING
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED
  let TRANCH_STATE_CANCELLED

  let getTranchToken

  let evmClock

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    // wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)

    // entity
    await ensureEntityImplementationsAreDeployed({ artifacts }, acl.address, settings.address)
    const entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts }, acl.address, settings.address)

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    const entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    const entityContext = await entityProxy.aclContext()

    // entity manager
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[1]

    const [ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address)

    // get current evm time
    baseDate = parseInt((await settings.getTime()).toString(10))

    // roles
    capitalProvider = accounts[5]
    insuredParty = accounts[6]
    await acl.assignRole(entityContext, insuredParty, ROLES.ENTITY_REP)

    // initiation time is 20 seconds from now
    initiationDate = baseDate + 1000
    startDate = initiationDate + 1000
    maturationDate = startDate + 2000
    premiumIntervalSeconds = 500

    const createPolicyTx = await createPolicy(entity, {
      initiationDate,
      startDate,
      maturationDate,
      premiumIntervalSeconds,
      unit: etherToken.address,
      capitalProviderCommissionBP,
      brokerCommissionBP,
      naymsCommissionBP,
      capitalProvider,
      insuredParty,
    }, { from: entityManagerAddress })
    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy
    policyOwnerAddress = entityManagerAddress

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicy.at(policyAddress)
    const policyContext = await policyProxy.aclContext()

    // get market address
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)

    // setup two tranches
    await createTranch(policy, {
      numShares: 100,
      pricePerShareAmount: 2,
      premiums: [10, 20, 30, 40, 50, 60, 70],
    }, { from: policyOwnerAddress })

    await createTranch(policy, {
      numShares: 50,
      pricePerShareAmount: 2,
      premiums: [10, 20, 30, 40, 50, 60, 70],
    }, { from: policyOwnerAddress })

    getTranchToken = async idx => {
      const { token_: tt } = await policy.getTranchInfo(idx)
      return await IERC20.at(tt)
    }

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_SELLING = await policyStates.POLICY_STATE_SELLING()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    TRANCH_STATE_CREATED = await policyStates.TRANCH_STATE_CREATED()
    TRANCH_STATE_SELLING = await policyStates.TRANCH_STATE_SELLING()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
    evmClock = new EvmClock(baseDate)
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('tranches begin selling', async () => {
    it('but not if initiation date has not yet passed', async () => {
      await policy.checkAndUpdateState()
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CREATED })
    })

    describe('if initiation date has passed', () => {
      it('but not if tranch premiums have not been paid', async () => {
        await createTranch(policy, {
          numShares: 50,
          pricePerShareAmount: 2,
          premiums: [10, 20, 30],
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)

        // pay all tranches except the second one
        await policy.payTranchPremium(0, 10)
        await policy.payTranchPremium(2, 10)

        await evmClock.setAbsoluteTime(initiationDate)

        await policy.checkAndUpdateState().should.be.fulfilled
        await policy.getTranchInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: 0,
        })
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CREATED })
      })

      describe('once tranch premiums are up-to-date', () => {
        beforeEach(async () => {
          await etherToken.deposit({ value: 100 })
          await etherToken.approve(policy.address, 100)
          await policy.payTranchPremium(0, 10)
          await policy.payTranchPremium(1, 10)
          await evmClock.setAbsoluteTime(initiationDate)
        })

        it('but not if initial allocation is not to parent policy', async () => {
          await createTranch(policy, {
            numShares: 100,
            pricePerShareAmount: 2,
            initialBalanceHolder: accounts[3],
          }, { from: policyOwnerAddress })

          await policy.checkAndUpdateState().should.be.rejectedWith('initial holder must be policy contract')
        })

        it('and then tranches get put on the market', async () => {
          // check order ids are not yet set
          await policy.getTranchInfo(0).should.eventually.matchObj({
            initialSaleOfferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            initialSaleOfferId_: 0,
          })

          const tranchTokens = await Promise.all([getTranchToken(0), getTranchToken(1)])

          await tranchTokens[0].balanceOf(market.address).should.eventually.eq(0)
          await tranchTokens[1].balanceOf(market.address).should.eventually.eq(0)

          await tranchTokens[0].balanceOf(policy.address).should.eventually.eq(100)
          await tranchTokens[1].balanceOf(policy.address).should.eventually.eq(50)

          const result = await policy.checkAndUpdateState()

          const ev = extractEventArgs(result, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_SELLING.toString())

          await tranchTokens[0].balanceOf(market.address).should.eventually.eq(100)
          await tranchTokens[1].balanceOf(market.address).should.eventually.eq(50)

          await tranchTokens[0].balanceOf(policy.address).should.eventually.eq(0)
          await tranchTokens[1].balanceOf(policy.address).should.eventually.eq(0)

          // check order ids are set
          await policy.getTranchInfo(0).should.eventually.not.matchObj({
            initialSaleOfferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.not.matchObj({
            initialSaleOfferId_: 0,
          })
        })

        it('and then policy state gets updated', async () => {
          await policy.checkAndUpdateState()
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING })
        })

        it('and then tranch states get updated', async () => {
          await policy.checkAndUpdateState()
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_SELLING,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            sharesSold_: 0,
          })
        })

        it('claims cannot yet be made', async () => {
          await policy.makeClaim(0, entity.address, 1, { from: insuredParty }).should.be.rejectedWith('must be in active state')
        })
      })
    })
  })

  describe('once tranches begins selling', () => {
    let tranchToken
    let marketOfferId

    beforeEach(async () => {
      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0, 10)
      await policy.payTranchPremium(1, 10)

      await evmClock.setAbsoluteTime(initiationDate)
      await policy.checkAndUpdateState()

      await policy.getTranchInfo(0).should.eventually.matchObj({
        sharesSold_: 0,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        sharesSold_: 0,
      })

      tranchToken = await getTranchToken(0)

      ;({ initialSaleOfferId_: marketOfferId } = await policy.getTranchInfo(0))

      // get some wrapped ETH for buyer account
      await etherToken.deposit({ from: accounts[2], value: 25 })
    })

    it('claims cannot yet be made', async () => {
      await policy.makeClaim(0, entity.address, 1, { from: insuredParty }).should.be.rejectedWith('must be in active state')
    })

    describe('another party can make an offer that does not match', () => {
      beforeEach(async () => {
        // check initial balances
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
        await etherToken.balanceOf(policy.address).should.eventually.eq(20) /* premium payments: 10 + 10 */
        await etherToken.balanceOf(market.address).should.eventually.eq(0)
        await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
        await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
        await tranchToken.balanceOf(market.address).should.eventually.eq(100)

        // make the offer on the market
        await etherToken.approve(market.address, 10, { from: accounts[2] })
        await market.offer(10, etherToken.address, 5000, tranchToken.address, 0, true, { from: accounts[2] })

        // check balances again
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
        await etherToken.balanceOf(policy.address).should.eventually.eq(20)
        await etherToken.balanceOf(market.address).should.eventually.eq(10)
        await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
        await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
        await tranchToken.balanceOf(market.address).should.eventually.eq(100)
      })

      it('and tranch status is unchanged', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          state_: TRANCH_STATE_SELLING,
        })
      })

      it('and tranch balance is unchanged', async () => {
        const b = (await policy.getTranchInfo(0)).balance_
        expect(b.toNumber()).to.eq(calcPremiumsMinusCommissions({
          premiums: [10],
          capitalProviderCommissionBP,
          brokerCommissionBP,
          naymsCommissionBP,
        }))
      })

      it('and the tally of shares sold is unchanged', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          sharesSold_: 0,
        })
      })

      it('and market offer is still active', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: marketOfferId,
        })
        await market.isActive(marketOfferId).should.eventually.eq(true)
      })
    })

    describe('another party can make offers that do match but dont buy the tranch completely', () => {
      beforeEach(async () => {
        // check initial balances
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
        await etherToken.balanceOf(policy.address).should.eventually.eq(20)  /* premium payments: 10 + 10 */
        await etherToken.balanceOf(market.address).should.eventually.eq(0)
        await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
        await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
        await tranchToken.balanceOf(market.address).should.eventually.eq(100)

        // make some offers on the market
        await etherToken.approve(market.address, 10, { from: accounts[2] })
        await market.offer(4, etherToken.address, 2, tranchToken.address, 0, true, { from: accounts[2] })
        await market.offer(6, etherToken.address, 3, tranchToken.address, 0, true, { from: accounts[2] })

        // check balances again
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
        await etherToken.balanceOf(policy.address).should.eventually.eq(20 + 10)
        await etherToken.balanceOf(market.address).should.eventually.eq(0)
        await tranchToken.balanceOf(accounts[2]).should.eventually.eq(5)
        await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
        await tranchToken.balanceOf(market.address).should.eventually.eq(95)
      })

      it('and tranch status is unchanged', async () => {
        // tranch status unchanged
        await policy.getTranchInfo(0).should.eventually.matchObj({
          state_: TRANCH_STATE_SELLING,
        })
      })

      it('and tranch balance has been updated', async () => {
        const b = (await policy.getTranchInfo(0)).balance_
        expect(b.toNumber()).to.eq(10 + calcPremiumsMinusCommissions({
          premiums: [10],
          capitalProviderCommissionBP,
          brokerCommissionBP,
          naymsCommissionBP,
        }))
      })

      it('and tally of shares sold has been updated', async () => {
        // check shares sold
        await policy.getTranchInfo(0).should.eventually.matchObj({
          sharesSold_: 5,
        })
      })

      it('and market offer is still active', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: marketOfferId,
        })
        await market.isActive(marketOfferId).should.eventually.eq(true)
      })
    })

    it('new token owners cannot trade their tokens whilst tranch is still selling', async () => {
      // get tranch tokens
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      await market.offer(10, etherToken.address, 5, tranchToken.address, 0, true, { from: accounts[2] })
      // check balance
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(5)
      // try trading again
      await market.offer(1, tranchToken.address, 1, etherToken.address, 0, true, { from: accounts[2] }).should.be.rejectedWith('can only trade when policy is active')
    })

    describe('if a tranch fully sells out', () => {
      let txResult

      beforeEach(async () => {
        // make the offer on the market
        const tranchToken = await getTranchToken(0)

        // buy the whole tranch
        await etherToken.deposit({ from: accounts[2], value: 200 })
        await etherToken.approve(market.address, 200, { from: accounts[2] })
        txResult = await market.offer(200, etherToken.address, 100, tranchToken.address, 0, true, { from: accounts[2] })
      })

      it('emits tranch state updated event', async () => {
        const ev = extractEventArgs(txResult, events.TranchStateUpdated)
        expect(ev.tranchIndex).to.eq('0')
        expect(ev.state).to.eq(TRANCH_STATE_ACTIVE.toString())
      })

      it('then its status is set to active', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          state_: TRANCH_STATE_ACTIVE,
        })
      })

      it('then tranch balance has been updated', async () => {
        const b = (await policy.getTranchInfo(0)).balance_
        expect(b.toNumber()).to.eq(200 + calcPremiumsMinusCommissions({
          premiums: [10],
          capitalProviderCommissionBP,
          brokerCommissionBP,
          naymsCommissionBP,
        }))
      })

      it('and the tally of shares sold gets updated', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          sharesSold_: 100,
        })
      })

      it('and the market offer is closed', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: marketOfferId,
        })
        await market.isActive(marketOfferId).should.eventually.eq(false)
      })
    })
  })

  describe('sale gets ended', async () => {
    it('but not if start date has not passed', async () => {
      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0, 10)
      await policy.payTranchPremium(1, 10)

      await evmClock.setAbsoluteTime(initiationDate)
      await policy.checkAndUpdateState()
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING })
    })

    describe('once start date has passed', () => {
      let offerId0
      let offerId1

      beforeEach(async () => {
        await etherToken.deposit({ value: 1000 })
        await etherToken.approve(policy.address, 1000)
        await policy.payTranchPremium(0, 20)
        await policy.payTranchPremium(1, 20)

        await evmClock.setAbsoluteTime(initiationDate)

        // kick-off the sale
        await policy.checkAndUpdateState()

        ;({ initialSaleOfferId_: offerId0 } = await policy.getTranchInfo(0))
        ;({ initialSaleOfferId_: offerId1 } = await policy.getTranchInfo(1))
        expect(offerId0).to.not.eq(0)
        expect(offerId1).to.not.eq(0)
      })

      it('unsold tranches have their market orders automatically cancelled', async () => {
        // heartbeat
        await evmClock.setAbsoluteTime(startDate)
        await policy.checkAndUpdateState()

        await policy.getTranchInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: offerId0,
        })
        await policy.getTranchInfo(1).should.eventually.matchObj({
          initialSaleOfferId_: offerId1,
        })

        await market.isActive(offerId0).should.eventually.eq(false)
        await market.isActive(offerId1).should.eventually.eq(false)
      })

      it('cancelled tranches emit events', async () => {
        await evmClock.setAbsoluteTime(startDate)
        const ret = await policy.checkAndUpdateState()

        const evs = parseEvents(ret, events.TranchStateUpdated)
        expect(evs.length).to.eq(2)

        const [ ev1, ev2 ] = evs

        expect(ev1.args.tranchIndex).to.eq('0')
        expect(ev1.args.state).to.eq(TRANCH_STATE_CANCELLED.toString())

        expect(ev2.args.tranchIndex).to.eq('1')
        expect(ev2.args.state).to.eq(TRANCH_STATE_CANCELLED.toString())
      })

      describe('even if none of the tranches are active the policy still gets made active', () => {
        it('and updates internal state', async () => {
          await evmClock.setAbsoluteTime(startDate)
          await policy.checkAndUpdateState()

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })

          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
        })

        it('and it emits an event', async () => {
          await evmClock.setAbsoluteTime(startDate)
          const result = await policy.checkAndUpdateState()

          const ev = extractEventArgs(result, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_ACTIVE.toString())
        })
      })

      describe('one of the tranches can be active but its premiums might not be up-to-date, in which case it gets cancelled', () => {
        beforeEach(async () => {
          const tranchToken = await getTranchToken(0)

          // buy the whole tranch to make it active
          await etherToken.deposit({ from: accounts[2], value: 1000 })
          await etherToken.approve(market.address, 200, { from: accounts[2] })
          await market.offer(200, etherToken.address, 100, tranchToken.address, 0, true, { from: accounts[2] })
        })

        it('and updates internal state', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          await policy.checkAndUpdateState()

          // now check
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
        })

        it('and it emits an event', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          const result = await policy.checkAndUpdateState()

          const evs = parseEvents(result, events.TranchStateUpdated)
          expect(evs.length).to.eq(2)

          const evsStates = evs.map(e => e.args.state)
          expect(evsStates[0]).to.eq(TRANCH_STATE_CANCELLED.toString())
          expect(evsStates[1]).to.eq(TRANCH_STATE_CANCELLED.toString())
        })
      })

      describe('atleast one of the tranches can be active and its premiums can be up-to-date, in which case it stays active', () => {
        beforeEach(async () => {
          // make the offer on the market
          const tranchToken = await getTranchToken(0)

          // buy the whole tranch to make it active
          await etherToken.deposit({ from: accounts[2], value: 1000 })
          await etherToken.approve(market.address, 200, { from: accounts[2] })
          const ret = await market.offer(200, etherToken.address, 100, tranchToken.address, 0, true, { from: accounts[2] })

          const ev = extractEventArgs(ret, events.TranchStateUpdated)
          expect(ev.tranchIndex).to.eq('0')
          expect(ev.state).to.eq(TRANCH_STATE_ACTIVE.toString())

          // pay its premiums upto start date
          await etherToken.approve(policy.address, 1000, { from: accounts[2] })
          let toPay = 0
          for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds >= i; i += 1) {
            toPay += (20 + 10 * i)
          }
          await policy.payTranchPremium(0, toPay, { from: accounts[2] })
        })

        it('updates internal state', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          await policy.checkAndUpdateState()

          // now check
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_ACTIVE,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
        })

        it('emits an event', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          const result = await policy.checkAndUpdateState()

          const evs = parseEvents(result, events.TranchStateUpdated)
          expect(evs.length).to.eq(1)

          const [ ev ] = evs
          expect(ev.args.state).to.eq(TRANCH_STATE_CANCELLED.toString())
          expect(ev.args.tranchIndex).to.eq('1')
        })
      })

      it('once policy becomes active, then token owners can start trading', async () => {
        // make the offer on the market
        const tranchToken = await getTranchToken(0)

        // buy the whole tranch to make it active
        await etherToken.deposit({ from: accounts[2], value: 1000 })
        await etherToken.approve(market.address, 200, { from: accounts[2] })
        await market.offer(200, etherToken.address, 100, tranchToken.address, 0, true, { from: accounts[2] })
        // pay all premiums upto start date
        await etherToken.approve(policy.address, 1000, { from: accounts[2] })
        let toPay = 0
        for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds >= i; i += 1) {
          toPay += (20 + 10 * i)
        }
        await policy.payTranchPremium(0, toPay, { from: accounts[2] })

        // end sale
        await evmClock.setAbsoluteTime(startDate)
        await policy.checkAndUpdateState()

        // try trading
        await market.offer(1, tranchToken.address, 1, etherToken.address, 0, true, { from: accounts[2] }).should.be.fulfilled

        // check balance
        await tranchToken.balanceOf(accounts[2]).should.eventually.eq(99)
      })
    })
  })

  describe('if policy has been active for a while state can be checked again', async () => {
    let nextPremium

    beforeEach(async () => {
      // pay first premiums
      await etherToken.deposit({ value: 2000 })
      await etherToken.approve(policy.address, 2000)
      await policy.payTranchPremium(0, 10)
      await policy.payTranchPremium(1, 10)

      // pass the inititation date
      await evmClock.setAbsoluteTime(initiationDate)

      // start the sale
      await policy.checkAndUpdateState()

      // sell-out the tranches
      await etherToken.deposit({ value: 2000, from: accounts[2] })
      await etherToken.approve(market.address, 2000, { from: accounts[2] })

      const tranch0Address = ((await getTranchToken(0))).address
      await market.offer(200, etherToken.address, 100, tranch0Address, 0, true, { from: accounts[2] })

      const tranch1Address = ((await getTranchToken(1))).address
      await market.offer(100, etherToken.address, 50, tranch1Address, 0, true, { from: accounts[2] })

      // pay premiums upto start date
      let toPay = 0
      for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds > i; i += 1) {
        nextPremium = (20 + 10 * i)
        toPay += nextPremium
      }
      await policy.payTranchPremium(0, toPay)
      await policy.payTranchPremium(1, toPay)
      nextPremium += 10

      // pass the start date
      await evmClock.setAbsoluteTime(startDate)

      // end the sale
      await policy.checkAndUpdateState()

      // sanity check
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
    })

    it('and it remains active if all premium payments are up to date', async () => {
      await policy.payTranchPremium(0, nextPremium)
      await policy.payTranchPremium(1, nextPremium)

      await evmClock.moveTime(premiumIntervalSeconds)
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
    })

    it('and it still stays active if any tranch premium payments have been missed, though that tranch gets cancelled', async () => {
      await policy.payTranchPremium(0, nextPremium)
      // await policy.payTranchPremium(1) - deliberately miss this payment

      await evmClock.moveTime(premiumIntervalSeconds)
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        state_: TRANCH_STATE_CANCELLED,
      })
    })

    describe('claims can be made', () => {
      beforeEach(async () => {
        await policy.payTranchPremium(0, nextPremium)
        await policy.payTranchPremium(1, nextPremium)

        await evmClock.moveTime(premiumIntervalSeconds)
        await policy.checkAndUpdateState()
      })

      describe('and once made', () => {
        beforeEach(async () => {
          await policy.makeClaim(0, entity.address, 1, { from: insuredParty })
          await policy.makeClaim(0, entity.address, 2, { from: insuredParty })
          await policy.makeClaim(1, entity.address, 4, { from: insuredParty })
          await policy.makeClaim(1, entity.address, 7, { from: insuredParty })
        })

        it('they can then be approved or declined', async () => {
          await policy.declineClaim(0, { from: capitalProvider })
          await policy.makeClaim(0, entity.address, 1, { from: insuredParty })
          await policy.approveClaim(1, { from: capitalProvider })
        })

        it('and approved ones can be paid out', async () => {
          await policy.declineClaim(0, { from: capitalProvider })
          await policy.approveClaim(1, { from: capitalProvider })
          await policy.approveClaim(3, { from: capitalProvider })

          const preBalance = ((await etherToken.balanceOf(entity.address)).toNumber())

          const policyContext = await policy.aclContext()
          await acl.assignRole(policyContext, accounts[1], ROLES.SYSTEM_MANAGER)
          await policy.payClaim(1, { from: accounts[1] })
          await policy.payClaim(3, { from: accounts[1] })

          const postBalance = ((await etherToken.balanceOf(entity.address)).toNumber())

          expect(postBalance - preBalance).to.eq(9)
        })
      })
    })

    describe('once maturation date has passed', () => {
      describe('if there are no pending claims and NOT all premium payments are up-to-date', () => {
        beforeEach(async () => {
          await policy.payTranchPremium(0, nextPremium)
          await policy.payTranchPremium(1, nextPremium)
        })

        it('closes the policy and tries to buys back all tranch tokens', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          const ret = await policy.checkAndUpdateState()

          const ev = extractEventArgs(ret, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_MATURED.toString())

          const evs = parseEvents(ret, events.TranchStateUpdated)
          expect(evs.length).to.eq(2)
          expect(evs[0].args.tranchIndex).to.eq('0')
          expect(evs[0].args.state).to.eq(TRANCH_STATE_CANCELLED.toString())
          expect(evs[1].args.tranchIndex).to.eq('1')
          expect(evs[1].args.state).to.eq(TRANCH_STATE_CANCELLED.toString())

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(0).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
        })

        it('unless there are pending claims', async () => {
          await policy.makeClaim(0, entity.address, 1, { from: insuredParty })
          await policy.makeClaim(0, entity.address, 2, { from: insuredParty })

          await evmClock.setAbsoluteTime(maturationDate)
          const ret = await policy.checkAndUpdateState()

          const ev = extractEventArgs(ret, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_MATURED.toString())
          const preEvs = parseEvents(ret, events.TranchStateUpdated).filter(e => e.args.state === TRANCH_STATE_CANCELLED.toString())
          expect(preEvs.length).to.eq(2)

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })

          await policy.getTranchInfo(0).should.eventually.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            finalBuybackofferId_: 0,
          })

          await policy.declineClaim(0, { from: capitalProvider })
          await policy.approveClaim(1, { from: capitalProvider })

          const ret2 = await policy.checkAndUpdateState()
          const postEvs = parseEvents(ret2, events.TranchStateUpdated)
          expect(postEvs.length).to.eq(0) // tranches are already cancelled, and so stay that way

          await policy.getTranchInfo(0).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
        })

        it('and subsequent calls have no effect', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()

          const { finalBuybackofferId_: offer1 } = await policy.getTranchInfo(0)
          expect(offer1).to.not.eq(0)
          const { finalBuybackofferId_: offer2 } = await policy.getTranchInfo(1)
          expect(offer2).to.not.eq(0)

          await policy.checkAndUpdateState()

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            finalBuybackofferId_: offer1,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            finalBuybackofferId_: offer2,
          })
        })

        it('and no more claims can be made', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()
          await policy.makeClaim(0, entity.address, 1, { from: insuredParty }).should.be.rejectedWith('must be in active state')
        })
      })

      describe('if there are no pending claims and all premium payments are up-to-date', () => {
        beforeEach(async () => {
          const t0 = await policy.getTranchInfo(0)
          let nextPremiumAmount0 = t0.nextPremiumAmount_.toNumber()
          const numPremiums0 = t0.numPremiums_.toNumber()
          const numPremiumsPaid0 = t0.numPremiumsPaid_.toNumber()
          let toPay0 = 0
          for (let i = numPremiumsPaid0 + 1; numPremiums0 >= i; i += 1) {
            toPay0 += nextPremiumAmount0
            nextPremiumAmount0 += 10
          }
          await policy.payTranchPremium(0, toPay0)

          const t1 = await policy.getTranchInfo(1)
          let nextPremiumAmount1 = t1.nextPremiumAmount_.toNumber()
          const numPremiums1 = t1.numPremiums_.toNumber()
          const numPremiumsPaid1 = t1.numPremiumsPaid_.toNumber()
          let toPay1 = 0
          for (let i = numPremiumsPaid1 + 1; numPremiums1 >= i; i += 1) {
            toPay1 += nextPremiumAmount1
            nextPremiumAmount1 += 10
          }
          await policy.payTranchPremium(1, toPay1)
        })

        it('closes the policy and tries to buys back all tranch tokens', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          const ret = await policy.checkAndUpdateState()

          const ev = extractEventArgs(ret, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_MATURED.toString())

          const tEvs = parseEvents(ret, events.TranchStateUpdated).filter(e => e.args.state === TRANCH_STATE_MATURED.toString())
          expect(tEvs.length).to.eq(2)

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_MATURED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_MATURED,
          })
          await policy.getTranchInfo(0).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
        })


        it('unless there are pending claims', async () => {
          await policy.makeClaim(0, entity.address, 1, { from: insuredParty })
          await policy.makeClaim(0, entity.address, 2, { from: insuredParty })

          await evmClock.setAbsoluteTime(maturationDate)
          const ret = await policy.checkAndUpdateState()

          const ev = extractEventArgs(ret, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_MATURED.toString())

          const preEvs = parseEvents(ret, events.TranchStateUpdated)
          expect(preEvs.length).to.eq(0)

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            finalBuybackofferId_: 0,
          })

          await policy.declineClaim(0, { from: capitalProvider })
          await policy.approveClaim(1, { from: capitalProvider })

          const ret2 = await policy.checkAndUpdateState()

          const postEvs = parseEvents(ret2, events.TranchStateUpdated)
          expect(postEvs.length).to.eq(2)
          const postEvStates = postEvs.map(e => e.args.state)
          expect(postEvStates[0]).to.eq(TRANCH_STATE_MATURED.toString())
          expect(postEvStates[1]).to.eq(TRANCH_STATE_MATURED.toString())

          await policy.getTranchInfo(0).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTranchInfo(1).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
        })

        it('and subsequent calls have no effect', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()

          const { finalBuybackofferId_: offer1 } = await policy.getTranchInfo(0)
          expect(offer1).to.not.eq(0)
          const { finalBuybackofferId_: offer2 } = await policy.getTranchInfo(1)
          expect(offer2).to.not.eq(0)

          await policy.checkAndUpdateState()

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_MATURED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_MATURED,
          })
          await policy.getTranchInfo(0).should.eventually.matchObj({
            finalBuybackofferId_: offer1,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            finalBuybackofferId_: offer2,
          })
        })

        it('and no more claims can be made', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()
          await policy.makeClaim(0, entity.address, 1, { from: insuredParty }).should.be.rejectedWith('must be in active state')
        })
      })

      describe('once it tries to buy back all tokens', async () => {
        beforeEach(async () => {
          const t0 = await policy.getTranchInfo(0)                
          const numPremiums0 = t0.numPremiums_.toNumber()
          let numPremiumsPaid0 = t0.numPremiumsPaid_.toNumber()
          let nextPremiumAmount0 = t0.nextPremiumAmount_.toNumber()
          let toPay0 = 0
          for (let i = numPremiumsPaid0 + 1; numPremiums0 >= i; i += 1) {          
            toPay0 += nextPremiumAmount0
            nextPremiumAmount0 += 10
          }
          await policy.payTranchPremium(0, toPay0)

          const t1 = await policy.getTranchInfo(1)
          let nextPremiumAmount1 = t1.nextPremiumAmount_.toNumber()
          const numPremiums1 = t1.numPremiums_.toNumber()
          const numPremiumsPaid1 = t1.numPremiumsPaid_.toNumber()
          let toPay1 = 0
          for (let i = numPremiumsPaid1 + 1; numPremiums1 >= i; i += 1) {
            toPay1 += nextPremiumAmount1
            nextPremiumAmount1 += 10  
          }
          await policy.payTranchPremium(1, toPay1)

          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()
        })

        it('other people can trade their previously purchased tranch tokens in for (hopefully) profit ', async () => {
          const preBalance = (await etherToken.balanceOf(accounts[2])).toNumber()

          const { finalBuybackofferId_: buybackOfferId } = await policy.getTranchInfo(0)

          const tranch0Address = (await getTranchToken(0)).address

          await market.sellAllAmount(tranch0Address, 100, etherToken.address, 0, { from: accounts[2] });

          // check that order has been fulfilled
          await market.isActive(buybackOfferId).should.eventually.eq(false)

          const postBalance = (await etherToken.balanceOf(accounts[2])).toNumber()

          const expectedPremiumBalance = calcPremiumsMinusCommissions({
            premiums: [10, 20, 30, 40, 50, 60, 70],
            capitalProviderCommissionBP,
            brokerCommissionBP,
            naymsCommissionBP,
          })

          expect(postBalance - preBalance).to.eq(200 + expectedPremiumBalance) /* 200 = initial sold amount */
        })
      })
    })
  })
})

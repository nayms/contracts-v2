import {
  extractEventArgs,
  ADDRESS_ZERO,
  createTranch,
  createPolicy,
  EvmClock,
  calcPremiumsMinusCommissions,
} from './utils'

import { events } from '../'
import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ROLES, ROLEGROUPS } from '../utils/constants'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IEntityImpl = artifacts.require('./base/IEntityImpl')
const EntityImpl = artifacts.require('./EntityImpl')
const Entity = artifacts.require('./Entity')
const IPolicyImpl = artifacts.require("./base/IPolicyImpl")
const Policy = artifacts.require("./Policy")
const IERC20 = artifacts.require("./base/IERC20")

contract('Policy flow', accounts => {
  const assetManagerCommissionBP = 100
  const brokerCommissionBP = 200
  const naymsCommissionBP = 300

  let acl
  let systemContext
  let settings
  let policyImpl
  let policyProxy
  let policy
  let premiumIntervalSeconds
  let baseDate
  let initiationDate
  let startDate
  let maturationDate
  let market
  let etherToken
  let entityManagerAddress
  let policyOwnerAddress

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

  beforeEach(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    // wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)

    // entity
    const entityImpl = await EntityImpl.new(acl.address, settings.address)
    const entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts }, acl.address, settings.address, entityImpl.address)

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    const entityProxy = await Entity.at(entityAddress)
    const entity = await IEntityImpl.at(entityAddress)
    const entityContext = await entityProxy.aclContext()

    // entity manager
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[1]

    ;({ policyImpl } = await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address))

    // get current evm time
    baseDate = parseInt((await settings.getTime()).toString(10))

    // initiation time is 20 seconds from now
    initiationDate = baseDate + 1000
    startDate = initiationDate + 1000
    maturationDate = startDate + 2000
    premiumIntervalSeconds = 500

    const createPolicyTx = await createPolicy(entity, policyImpl.address, {
      initiationDate,
      startDate,
      maturationDate,
      premiumIntervalSeconds,
      unit: etherToken.address,
      assetManagerCommissionBP,
      brokerCommissionBP,
      naymsCommissionBP,
    }, { from: entityManagerAddress })
    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy
    policyOwnerAddress = entityManagerAddress

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicyImpl.at(policyAddress)
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
      const tt = await policy.getTranchToken(idx)
      return await IERC20.at(tt)
    }

    POLICY_STATE_CREATED = await policy.POLICY_STATE_CREATED()
    POLICY_STATE_SELLING = await policy.POLICY_STATE_SELLING()
    POLICY_STATE_ACTIVE = await policy.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policy.POLICY_STATE_MATURED()

    TRANCH_STATE_CREATED = await policy.TRANCH_STATE_CREATED()
    TRANCH_STATE_SELLING = await policy.TRANCH_STATE_SELLING()
    TRANCH_STATE_ACTIVE = await policy.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policy.TRANCH_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policy.TRANCH_STATE_CANCELLED()

    evmClock = new EvmClock(baseDate)
  })

  describe('tranches begin selling', async () => {
    it('but not if initiation date has not yet passed', async () => {
      await policy.checkAndUpdateState()
      await policy.getState().should.eventually.eq(POLICY_STATE_CREATED)
    })

    describe('if initiation date has passed', () => {
      beforeEach(async () => {
        await evmClock.setTime(initiationDate)
      })

      it('but not if tranch premiums have not been paid', async () => {
        await createTranch(policy, {
          numShares: 50,
          pricePerShareAmount: 2,
          premiums: [10, 20, 30],
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)

        // pay all tranches except the second one
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(2)

        await policy.checkAndUpdateState().should.be.rejectedWith('tranch premiums are not up-to-date')
      })

      describe('once tranch premiums are up-to-date', () => {
        beforeEach(async () => {
          await etherToken.deposit({ value: 100 })
          await etherToken.approve(policy.address, 100)
          await policy.payTranchPremium(0)
          await policy.payTranchPremium(1)
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

          expect(extractEventArgs(result, events.BeginSale)).to.include({
            policy: policy.address,
            caller: accounts[0],
          })

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
          await policy.getState().should.eventually.eq(POLICY_STATE_SELLING)
        })

        it('and then tranch states get updated', async () => {
          await policy.checkAndUpdateState()
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_SELLING,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            sharesSold_: TRANCH_STATE_SELLING,
          })
        })
      })
    })
  })

  describe('once tranches begins selling', () => {
    let tranchToken
    let marketOfferId

    beforeEach(async () => {
      await evmClock.setTime(initiationDate)

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)

      await policy.checkAndUpdateState()

      await policy.getTranchInfo(0).should.eventually.matchObj({
        sharesSold_: 0,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        sharesSold_: 0,
      })

      tranchToken = await getTranchToken(0)

      // get some wrapped ETH for buyer account
      await etherToken.deposit({ from: accounts[2], value: 25 })

      marketOfferId = await policy.getTranchInitialSaleMarketOfferId(0)
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
        await policy.getTranchBalance(0).should.eventually.eq(calcPremiumsMinusCommissions({
          premiums: [10],
          assetManagerCommissionBP,
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
        await policy.getTranchBalance(0).should.eventually.eq(10 + calcPremiumsMinusCommissions({
          premiums: [10],
          assetManagerCommissionBP,
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
      beforeEach(async () => {
        // make the offer on the market
        const tranchToken = await getTranchToken(0)

        // buy the whole tranch
        await etherToken.deposit({ from: accounts[2], value: 200 })
        await etherToken.approve(market.address, 200, { from: accounts[2] })
        await market.offer(200, etherToken.address, 100, tranchToken.address, 0, true, { from: accounts[2] })
      })

      it('then its status is set to active', async () => {
        await policy.getTranchInfo(0).should.eventually.matchObj({
          state_: TRANCH_STATE_ACTIVE,
        })
      })

      it('then tranch balance has been updated', async () => {
        await policy.getTranchBalance(0).should.eventually.eq(200 + calcPremiumsMinusCommissions({
          premiums: [10],
          assetManagerCommissionBP,
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
          initialSaleOfferId_: 0,
        })
        await market.isActive(marketOfferId).should.eventually.eq(false)
      })
    })
  })

  describe('sale gets ended', async () => {
    it('but not if start date has not passed', async () => {
      await evmClock.setTime(initiationDate)

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)

      await policy.checkAndUpdateState()
      await policy.checkAndUpdateState()

      await policy.getState().should.eventually.eq(POLICY_STATE_SELLING)
    })

    describe('once start date has passed', () => {
      let offerId0
      let offerId1

      beforeEach(async () => {
        await evmClock.setTime(initiationDate)

        await etherToken.deposit({ value: 1000 })
        await etherToken.approve(policy.address, 1000)
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(1)

        // kick-off the sale
        await policy.checkAndUpdateState()

        ;({ initialSaleOfferId_: offerId0 } = await policy.getTranchInfo(0))
        ;({ initialSaleOfferId_: offerId1 } = await policy.getTranchInfo(1))
        expect(offerId0).to.not.eq(0)
        expect(offerId1).to.not.eq(0)

        // now past the start date
        await evmClock.setTime(startDate)
      })

      it('unsold tranches have their market orders automatically cancelled', async () => {
        // heartbeat
        await policy.checkAndUpdateState()

        await policy.getTranchInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: 0,
        })
        await policy.getTranchInfo(1).should.eventually.matchObj({
          initialSaleOfferId_: 0,
        })

        await market.isActive(offerId0).should.eventually.eq(false)
        await market.isActive(offerId1).should.eventually.eq(false)
      })

      describe('even if none of the tranches are active the policy still gets made active', () => {
        it('and updates internal state', async () => {
          await policy.checkAndUpdateState()

          await policy.getState().should.eventually.eq(POLICY_STATE_ACTIVE)

          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
        })

        it('and it emits an event', async () => {
          const result = await policy.checkAndUpdateState()

          expect(extractEventArgs(result, events.PolicyActive)).to.include({
            policy: policy.address,
          })
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
          await policy.checkAndUpdateState()

          // now check
          await policy.getState().should.eventually.eq(POLICY_STATE_ACTIVE)
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
        })

        it('and it emits an event', async () => {
          // end sale
          const result = await policy.checkAndUpdateState()

          expect(extractEventArgs(result, events.PolicyActive)).to.include({
            policy: policy.address,
          })
        })
      })

      describe('atleast one of the tranches can be active and its premiums can be up-to-date, in which case it stays active', () => {
        beforeEach(async () => {
          // make the offer on the market
          const tranchToken = await getTranchToken(0)

          // buy the whole tranch to make it active
          await etherToken.deposit({ from: accounts[2], value: 1000 })
          await etherToken.approve(market.address, 200, { from: accounts[2] })
          await market.offer(200, etherToken.address, 100, tranchToken.address, 0, true, { from: accounts[2] })
          // pay its premiums upto start date
          await etherToken.approve(policy.address, 1000, { from: accounts[2] })
          for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds >= i; i += 1) {
            await policy.payTranchPremium(0, { from: accounts[2] })
          }
        })

        it('updates internal state', async () => {
          // end sale
          await policy.checkAndUpdateState()

          // now check
          await policy.getState().should.eventually.eq(POLICY_STATE_ACTIVE)
          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_ACTIVE,
          })
          await policy.getTranchInfo(1).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED,
          })
        })

        it('emits an event', async () => {
          // end sale
          const result = await policy.checkAndUpdateState()

          expect(extractEventArgs(result, events.PolicyActive)).to.include({
            policy: policy.address,
          })
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
        for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds >= i; i += 1) {
          await policy.payTranchPremium(0, { from: accounts[2] })
        }

        // end sale
        await policy.checkAndUpdateState()

        // try trading
        await market.offer(1, tranchToken.address, 1, etherToken.address, 0, true, { from: accounts[2] }).should.be.fulfilled

        // check balance
        await tranchToken.balanceOf(accounts[2]).should.eventually.eq(99)
      })
    })
  })

  describe('if policy has been active for a while state can be checked again', async () => {
    beforeEach(async () => {
      // pass the inititation date
      await evmClock.setTime(initiationDate)

      // pay first premiums
      await etherToken.deposit({ value: 2000 })
      await etherToken.approve(policy.address, 2000)
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)

      // start the sale
      await policy.checkAndUpdateState()

      // sell-out the tranches
      await etherToken.deposit({ value: 2000, from: accounts[2] })
      await etherToken.approve(market.address, 2000, { from: accounts[2] })

      const tranch0Address = await policy.getTranchToken(0)
      await market.offer(200, etherToken.address, 100, tranch0Address, 0, true, { from: accounts[2] })

      const tranch1Address = await policy.getTranchToken(1)
      await market.offer(100, etherToken.address, 50, tranch1Address, 0, true, { from: accounts[2] })

      // pay premiums upto start date
      for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds >= i; i += 1) {
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(1)
      }

      // pass the start date
      await evmClock.setTime(startDate)

      // end the sale
      await policy.checkAndUpdateState()

      // sanity check
      await policy.getState().should.eventually.eq(POLICY_STATE_ACTIVE)
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })

      // pass time: 2 x premiumIntervalSeconds
      await evmClock.moveTime(premiumIntervalSeconds * 2)
    })

    it('and it remains active if all premium payments are up to date', async () => {
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)

      const result = await policy.checkAndUpdateState()

      await policy.getState().should.eventually.eq(POLICY_STATE_ACTIVE)
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })

      expect(extractEventArgs(result, events.PolicyActive)).to.eq(null)
    })

    it('and it still stays active if any tranch premium payments have been missed, though that tranch gets cancelled', async () => {
      await policy.payTranchPremium(0)
      // await policy.payTranchPremium(1) - deliberately miss this payment

      const result = await policy.checkAndUpdateState()

      await policy.getState().should.eventually.eq(POLICY_STATE_ACTIVE)
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE,
      })
      await policy.getTranchInfo(1).should.eventually.matchObj({
        state_: TRANCH_STATE_CANCELLED,
      })

      expect(extractEventArgs(result, events.PolicyActive)).to.eq(null)
    })

    describe('once maturation date has passed', () => {
      beforeEach(async () => {
        // pass the maturation date
        await evmClock.setTime(maturationDate)
      })

      describe('if not all premium payments are up-to-date', () => {
        beforeEach(async () => {
          await policy.payTranchPremium(0)
          await policy.payTranchPremium(1)
        })

        it('closes the policy and tries to buys back all tranch tokens', async () => {
          await policy.checkAndUpdateState()

          await policy.getState().should.eventually.eq(POLICY_STATE_MATURED)

          await policy.getTranchInfo(0).should.eventually.matchObj({
            state_: TRANCH_STATE_ACTIVE,
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

        it('and subsequent calls have no effect', async () => {
          await policy.checkAndUpdateState()

          const offer1 = await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.not.eq(0)
          const offer2 = await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.not.eq(1)

          await policy.checkAndUpdateState()

          await policy.getState().should.eventually.eq(POLICY_STATE_MATURED)
          await policy.getTranchState(0).should.eventually.eq(TRANCH_STATE_CANCELLED)
          await policy.getTranchState(1).should.eventually.eq(TRANCH_STATE_CANCELLED)

          await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.eq(offer1)
          await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.eq(offer2)
        })
      })

      describe('if all premium payments are up-to-date', () => {
        beforeEach(async () => {
          for (let i = 0; (maturationDate - startDate) / premiumIntervalSeconds >= i; i += 1) {
            const allPaymentsMade0 = await policy.tranchPaymentsAllMade(0)
            if (!allPaymentsMade0) {
              await policy.payTranchPremium(0)
            }

            const allPaymentsMade1 = await policy.tranchPaymentsAllMade(1)
            if (!allPaymentsMade1) {
              await policy.payTranchPremium(1)
            }
          }
        })

        it('closes the policy and tries to buys back all tranch tokens', async () => {
          await policy.checkAndUpdateState()

          await policy.getState().should.eventually.eq(POLICY_STATE_MATURED)
          await policy.getTranchState(0).should.eventually.eq(TRANCH_STATE_MATURED)
          await policy.getTranchState(1).should.eventually.eq(TRANCH_STATE_MATURED)

          await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.not.eq(0)
          await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.not.eq(1)
        })

        it('and subsequent calls have no effect', async () => {
          await policy.checkAndUpdateState()

          const offer1 = await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.not.eq(0)
          const offer2 = await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.not.eq(1)

          await policy.checkAndUpdateState()

          await policy.getState().should.eventually.eq(POLICY_STATE_MATURED)
          await policy.getTranchState(0).should.eventually.eq(TRANCH_STATE_MATURED)
          await policy.getTranchState(1).should.eventually.eq(TRANCH_STATE_MATURED)

          await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.eq(offer1)
          await policy.getTranchFinalBuybackMarketOfferId(0).should.eventually.eq(offer2)
        })

        describe('once it tries to buy back all tokens', async () => {
          beforeEach(async () => {
            await policy.checkAndUpdateState()
          })

          it('other people can trade their previously purchased tranch tokens in for (hopefully) profit ', async () => {
            const preBalance = (await etherToken.balanceOf(accounts[2])).toNumber()

            const buybackOfferId = await policy.getTranchFinalBuybackMarketOfferId(0)

            const tranch0Address = await policy.getTranchToken(0)

            await market.sellAllAmount(tranch0Address, 100, etherToken.address, 0, { from: accounts[2] });

            // check that order has been fulfilled
            await market.isActive(buybackOfferId).should.eventually.eq(false)

            const postBalance = (await etherToken.balanceOf(accounts[2])).toNumber()

            const expectedPremiumBalance = calcPremiumsMinusCommissions({
              premiums: [10, 20, 30, 40, 50, 60, 70],
              assetManagerCommissionBP,
              brokerCommissionBP,
              naymsCommissionBP,
            })

            expect(postBalance - preBalance).to.eq(200 + expectedPremiumBalance) /* 200 = initial sold amount */
          })
        })
      })
    })
  })
})

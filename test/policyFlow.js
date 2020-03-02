import {
  extractEventArgs,
  ADDRESS_ZERO,
  createTranch,
  createPolicy,
  web3EvmIncreaseTime,
} from './utils'

import { events } from '../'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'

import { ROLES, ROLEGROUPS } from '../utils/constants'

import { ensureAclIsDeployed } from '../migrations/modules/acl'

import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'

const EntityDeployer = artifacts.require('./EntityDeployer')
const IEntityImpl = artifacts.require('./base/IEntityImpl')
const EntityImpl = artifacts.require('./EntityImpl')
const Entity = artifacts.require('./Entity')
const IPolicyImpl = artifacts.require("./base/IPolicyImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const Policy = artifacts.require("./Policy")
const IERC20 = artifacts.require("./base/IERC20")

contract('Policy flow', accounts => {
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

  let STATE_DRAFT
  let STATE_PENDING
  let STATE_ACTIVE
  let STATE_MATURED
  let STATE_CANCELLED

  let getTranchToken

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
    const entityDeployer = await EntityDeployer.new(acl.address, settings.address, entityImpl.address)

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    const entityProxy = await Entity.at(entityAddress)
    const entity = await IEntityImpl.at(entityAddress)
    const entityContext = await entityProxy.aclContext()

    // entity manager
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[1]

    policyImpl = await PolicyImpl.new(acl.address, settings.address)

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
      premiums: [1, 2, 3, 4, 5, 6, 7],
    }, { from: policyOwnerAddress })

    await createTranch(policy, {
      numShares: 50,
      pricePerShareAmount: 2,
      premiums: [1, 2, 3, 4, 5, 6, 7],
    }, { from: policyOwnerAddress })

    getTranchToken = async idx => {
      const tt = await policy.getTranchToken(idx)
      return await IERC20.at(tt)
    }

    STATE_DRAFT = await policy.STATE_DRAFT()
    STATE_PENDING = await policy.STATE_PENDING()
    STATE_ACTIVE = await policy.STATE_ACTIVE()
    STATE_CANCELLED = await policy.STATE_CANCELLED()
    STATE_MATURED = await policy.STATE_MATURED()
  })

  describe('tranches begin selling', async () => {
    describe('if initiation date has passed', () => {
      beforeEach(async () => {
        await web3EvmIncreaseTime(web3, initiationDate - baseDate)
      })

      it('but not if tranch premiums have not been paid', async () => {
        await createTranch(policy, {
          numShares: 50,
          pricePerShareAmount: 2,
          premiums: [1, 2, 3],
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
        })

        it('and then policy state gets updated', async () => {
          await policy.checkAndUpdateState()
          await policy.getState().should.eventually.eq(STATE_PENDING)
        })

        it('and then tranch states get updated', async () => {
          await policy.checkAndUpdateState()
          await policy.getTranchState(0).should.eventually.eq(STATE_PENDING)
          await policy.getTranchState(1).should.eventually.eq(STATE_PENDING)
        })
      })
    })
  })

  describe('once tranches begins selling', () => {
    let tranchToken

    beforeEach(async () => {
      await web3EvmIncreaseTime(web3, initiationDate - baseDate)

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)

      await policy.checkAndUpdateState()

      tranchToken = await getTranchToken(0)

      // get some wrapped ETH for buyer account
      await etherToken.deposit({ from: accounts[2], value: 25 })
    })

    it('another party can make an offer that does not match', async () => {
      // check initial balances
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
      await etherToken.balanceOf(policy.address).should.eventually.eq(2) // 2 tranch premiums already paid
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)

      // // make the offer on the market
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      await market.offer(10, etherToken.address, 5000, tranchToken.address, 0, true, { from: accounts[2] })

      // check balances again
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
      await etherToken.balanceOf(policy.address).should.eventually.eq(2)
      await etherToken.balanceOf(market.address).should.eventually.eq(10)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)
    })

    it('another party can make an offer that does match, but tranch status is unchanged because still some left to sell', async () => {
      // check initial balances
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
      await etherToken.balanceOf(policy.address).should.eventually.eq(2) // 2 tranch premiums already paid
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)

      // make the offer on the market
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      await market.offer(10, etherToken.address, 5, tranchToken.address, 0, true, { from: accounts[2] })

      // check balances again
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
      await etherToken.balanceOf(policy.address).should.eventually.eq(12)
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(5)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(95)

      // tranch status unchanged
      await policy.getTranchState(0).should.eventually.eq(STATE_PENDING)
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

    it('if a tranch fully sells out then its status is set to active', async () => {
      // make the offer on the market
      const tranchToken = await getTranchToken(0)

      // buy the whole tranch
      await etherToken.deposit({ from: accounts[2], value: 200 })
      await etherToken.approve(market.address, 200, { from: accounts[2] })
      await market.offer(200, etherToken.address, 100, tranchToken.address, 0, true, { from: accounts[2] })

      // tranch status updated to ACTIVE since it's fully sold
      await policy.getTranchState(0).should.eventually.eq(STATE_ACTIVE)
    })
  })

  describe('sale can be ended', async () => {
    it('but only if start date has passed', async () => {
      await web3EvmIncreaseTime(web3, initiationDate - baseDate)

      await etherToken.deposit({ value: 100 })
      await etherToken.approve(policy.address, 100)
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)
      await policy.checkAndUpdateState()

      await policy.checkAndUpdateState()

      await policy.getState().should.eventually.eq(STATE_PENDING)
    })

    describe('once start date has passed', () => {
      beforeEach(async () => {
        await web3EvmIncreaseTime(web3, initiationDate - baseDate)

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(1)
        await policy.checkAndUpdateState()

        // now past the start date
        await web3EvmIncreaseTime(web3, startDate - initiationDate)
      })

      describe('if none of the tranches are active then the policy still gets made active', () => {
        it('and updates internal state', async () => {
          await policy.checkAndUpdateState()

          await policy.getState().should.eventually.eq(STATE_ACTIVE)
          await policy.getTranchState(0).should.eventually.eq(STATE_CANCELLED)
          await policy.getTranchState(1).should.eventually.eq(STATE_CANCELLED)
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
          // make the offer on the market
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
          await policy.getState().should.eventually.eq(STATE_ACTIVE)
          await policy.getTranchState(0).should.eventually.eq(STATE_CANCELLED)
          await policy.getTranchState(1).should.eventually.eq(STATE_CANCELLED)
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
          // pay its premiums
          await etherToken.approve(policy.address, 100, { from: accounts[2] })
          for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds >= i; i += 1) {
            await policy.payTranchPremium(0, { from: accounts[2] })
          }
        })

        it('updates internal state', async () => {
          // end sale
          await policy.checkAndUpdateState()

          // now check
          await policy.getState().should.eventually.eq(STATE_ACTIVE)
          await policy.getTranchState(0).should.eventually.eq(STATE_ACTIVE)
          await policy.getTranchState(1).should.eventually.eq(STATE_CANCELLED)
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
        await etherToken.approve(policy.address, 100, { from: accounts[2] })
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
      await web3EvmIncreaseTime(web3, initiationDate - baseDate)

      // pay first premiums
      await etherToken.deposit({ value: 2000 })
      await etherToken.approve(policy.address, 2000)
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)

      // start the sale
      await policy.checkAndUpdateState()

      // sell-out the tranches
      await etherToken.deposit({ from: accounts[2], value: 2000 })
      await etherToken.approve(market.address, 2000, { from: accounts[2] })

      const tranch0Address = await policy.getTranchToken(0)
      await market.offer(200, etherToken.address, 100, tranch0Address, 0, true, { from: accounts[2] })

      const tranch1Address = await policy.getTranchToken(1)
      await market.offer(100, etherToken.address, 50, tranch1Address, 0, true, { from: accounts[2] })

      // pay premiums
      for (let i = 0; (startDate - initiationDate) / premiumIntervalSeconds >= i; i += 1) {
        await policy.payTranchPremium(0)
        await policy.payTranchPremium(1)
      }

      // pass the start date
      await web3EvmIncreaseTime(web3, startDate - initiationDate)

      // end the sale
      await policy.checkAndUpdateState()

      // sanity check
      await policy.getState().should.eventually.eq(STATE_ACTIVE)
      await policy.getTranchState(0).should.eventually.eq(STATE_ACTIVE)
      await policy.getTranchState(1).should.eventually.eq(STATE_ACTIVE)

      // pass time: 2 x premiumIntervalSeconds
      await web3EvmIncreaseTime(web3, premiumIntervalSeconds * 2)
    })

    it('and it remains active if all premium payments are up to date', async () => {
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(1)

      const result = await policy.checkAndUpdateState()

      await policy.getState().should.eventually.eq(STATE_ACTIVE)
      await policy.getTranchState(0).should.eventually.eq(STATE_ACTIVE)
      await policy.getTranchState(1).should.eventually.eq(STATE_ACTIVE)

      expect(extractEventArgs(result, events.PolicyActive)).to.eq(null)
    })

    it('and it still stays active if any tranch premium payments have been missed, though that tranch gets cancelled', async () => {
      await policy.payTranchPremium(0)
      // await policy.payTranchPremium(1) - deliberately miss this payment

      const result = await policy.checkAndUpdateState()

      await policy.getState().should.eventually.eq(STATE_ACTIVE)
      await policy.getTranchState(0).should.eventually.eq(STATE_ACTIVE)
      await policy.getTranchState(1).should.eventually.eq(STATE_CANCELLED)

      expect(extractEventArgs(result, events.PolicyActive)).to.eq(null)
    })
  })
})

import { ADDRESS_ZERO, BYTES_ZERO, EvmSnapshot } from './utils/index'
import { toBN, toWei, toHex } from './utils/web3'

import { getAccounts } from '../deploy/utils'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureMarketIsDeployed } from '../deploy/modules/market'
import { ensureFeeBankIsDeployed } from '../deploy/modules/feeBank'
import { expect } from 'chai'

const DummyToken = artifacts.require("DummyToken")
const DummyMarketObserver = artifacts.require("DummyMarketObserver")
const IMarketOfferStates = artifacts.require("base/IMarketOfferStates")
const IMarketFeeSchedules = artifacts.require("base/IMarketFeeSchedules")

describe('Market', () => {
  const evmSnapshot = new EvmSnapshot()

  let accounts
  let settings
  let acl
  let systemContext

  let market
  let erc20WETH
  let erc20WETH2
  let erc20DAI
  let erc20DAI2
  let mintAmount

  let OFFER_STATE_ACTIVE
  let OFFER_STATE_CANCELLED
  let OFFER_STATE_FULFILLED

  let FEE_SCHEDULE_STANDARD
  let FEE_SCHEDULE_PLATFORM_ACTION

  before(async () => {
    accounts = await getAccounts()
    erc20WETH = await DummyToken.new('Wrapped ETH', 'WETH', 18, 0, true, { from: accounts[0] })
    erc20WETH2 = await DummyToken.new('Wrapped ETH 2', 'WETH2', 18, 0, true, { from: accounts[0] })

    erc20DAI = await DummyToken.new('Dai Stablecoin', 'DAI', 18, 0, false, { from: accounts[0] })
    erc20DAI2 = await DummyToken.new('Dai Stablecoin 2', 'DAI2', 18, 0, false, { from: accounts[0] })

    mintAmount = toWei('1000')

    for (let i = 1; i <= 4; i++) {
      await erc20WETH.deposit({ value: mintAmount, from: accounts[i] })
      await erc20WETH2.deposit({ value: mintAmount, from: accounts[i] })
      await erc20DAI.deposit({ value: mintAmount, from: accounts[i] })
      await erc20DAI2.deposit({ value: mintAmount, from: accounts[i] })
    }

    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // market and fee bank
    market = await ensureMarketIsDeployed({ artifacts, settings })
    await ensureFeeBankIsDeployed({ artifacts, settings })

    const { facets: [marketCoreAddress] } = market
    const mktStates = await IMarketOfferStates.at(marketCoreAddress)
    OFFER_STATE_ACTIVE = await mktStates.OFFER_STATE_ACTIVE()
    OFFER_STATE_CANCELLED = await mktStates.OFFER_STATE_CANCELLED()
    OFFER_STATE_FULFILLED = await mktStates.OFFER_STATE_FULFILLED()

    const mktFeeSchedules = await IMarketFeeSchedules.at(marketCoreAddress)
    FEE_SCHEDULE_STANDARD = await mktFeeSchedules.FEE_SCHEDULE_STANDARD()
    FEE_SCHEDULE_PLATFORM_ACTION = await mktFeeSchedules.FEE_SCHEDULE_PLATFORM_ACTION()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('deployment checks', () => {
    it('should return deployed market address and not zero address', async () => {
      (market.address).should.not.equal(ADDRESS_ZERO)
    })
  })

  describe('config', () => {
    it('can be fetched', async () => {
      await market.getConfig().should.eventually.matchObj({
        dust_: 1,
        feeBP_: 0,
      })
    })
  })

  describe('fee', () => {
    describe('can be changed', () => {
      it('but not by anyone', async () => {
        await market.setFee(2, { from: accounts[1] }).should.be.rejectedWith('must be admin')
      })

      it('by admin', async () => {
        await market.setFee(2).should.be.fulfilled

        await market.getConfig().should.eventually.matchObj({
          feeBP_: 2,
        })
      })
    })

    describe('can be calculated per order', () => {
      beforeEach(async () => {
        await market.setFee(2000 /* 20% */)
      })

      it('but not if order uses two platform tokens', async () => {
        await market.calculateFee(erc20WETH.address, toWei('10'), erc20WETH2.address, toWei('5'), FEE_SCHEDULE_STANDARD).should.be.rejected
      })

      it('but not if order uses two currency tokens', async () => {
        await market.calculateFee(erc20DAI.address, toWei('10'), erc20DAI2.address, toWei('5'), FEE_SCHEDULE_STANDARD).should.be.rejected
      })

      it('and is always based on currency unit', async () => {
        await market.calculateFee(erc20WETH.address, toWei('10'), erc20DAI.address, toWei('5'), FEE_SCHEDULE_STANDARD).should.eventually.matchObj({
          feeToken_: erc20DAI.address,
          feeAmount_: toWei('1')
        })

        await market.calculateFee(erc20DAI.address, toWei('10'), erc20WETH.address, toWei('5'), FEE_SCHEDULE_STANDARD).should.eventually.matchObj({
          feeToken_: erc20DAI.address,
          feeAmount_: toWei('2')
        })
      })

      it('and is 0 for platform actions', async () => {
        await market.calculateFee(erc20WETH.address, toWei('10'), erc20DAI.address, toWei('5'), FEE_SCHEDULE_PLATFORM_ACTION).should.eventually.matchObj({
          feeToken_: erc20DAI.address,
          feeAmount_: '0'
        })
      })
    })
  })

  describe('platform token check', () => {    
    it('does not allow 2 non-platform tokens', async () => {
      const pay_amt = toWei('10')
      const buy_amt = toWei('10')

      await erc20DAI.approve(
        market.address,
        pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        pay_amt,
        erc20DAI2.address,
        buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      ).should.be.rejectedWith('must be one platform token')
    })

    it('does not allow 2 platform tokens', async () => {
      const pay_amt = toWei('10')
      const buy_amt = toWei('10')

      await erc20WETH.approve(
        market.address,
        pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        pay_amt,
        erc20WETH2.address,
        buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      ).should.be.rejectedWith('must be one platform token')
    })

    it('does allow 1 platform token', async () => {
      const pay_amt = toWei('10')
      const buy_amt = toWei('10')

      await erc20WETH.approve(
        market.address,
        pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        pay_amt,
        erc20DAI.address,
        buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      ).should.be.fulfilled

      await erc20DAI.approve(
        market.address,
        pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        pay_amt,
        erc20WETH.address,
        buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      ).should.be.fulfilled
    })
  })

  describe('last offer id', () => {
    it('get correct last offer id before creation of offers', async () => {
      await market.getLastOfferId().should.eventually.eq(0)
    })

    it('get correct last offer id before creation of one offer', async () => {
      const pay_amt = toWei('10')
      const buy_amt = toWei('10')

      await erc20WETH.approve(
        market.address,
        pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        pay_amt,
        erc20DAI.address,
        buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      )

      await market.getLastOfferId().should.eventually.eq(1)
    })
  })

  describe('supports getOffer, isActive and cancel', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('10');

      await erc20WETH.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        second_offer_pay_amt,
        erc20DAI.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      )

      // const eventArgs = extractEventArgs(secondOfferTx, events.LogUnsortedOffer)
      // expect(eventArgs).to.include({ id: '2' })
    })

    it('get correct last offer id after creation of offers', async () => {
      await market.getLastOfferId().should.eventually.eq(2)
    })

    it('should get correct offer owners balances after offers', async () => {
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - first_offer_pay_amt).toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq((mintAmount - second_offer_pay_amt).toString())
    })

    describe('getOwner', () => {
      it('should get correct offer owners', async () => {
        const firstOffer = await market.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])

        const secondOffer = await market.getOffer(2)
        expect(secondOffer.creator_).to.eq(accounts[2])
      })

    })

    describe('getOffer', () => {
      it('should get correct offer details for non-matching offers without matching them', async () => {
        const firstOffer = await market.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])
        expect(firstOffer.sellToken_).to.eq(erc20WETH.address)
        expect(firstOffer.sellAmount_.toString()).to.eq(first_offer_pay_amt)
        expect(firstOffer.sellAmountInitial_.toString()).to.eq(first_offer_pay_amt)
        expect(firstOffer.buyToken_).to.eq(erc20DAI.address)
        expect(firstOffer.buyAmount_.toString()).to.eq(first_offer_buy_amt)
        expect(firstOffer.buyAmountInitial_.toString()).to.eq(first_offer_buy_amt)
        expect(firstOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(firstOffer.state_).to.eq(OFFER_STATE_ACTIVE)
        expect(firstOffer.feeSchedule_).to.eq(FEE_SCHEDULE_STANDARD)

        const firstSiblings = await market.getOfferSiblings(1)
        expect(firstSiblings.nextOfferId_.toNumber()).to.eq(2)
        expect(firstSiblings.prevOfferId_.toNumber()).to.eq(0)

        const secondOffer = await market.getOffer(2)
        expect(secondOffer.creator_).to.eq(accounts[2])
        expect(secondOffer.sellToken_).to.eq(erc20WETH.address)
        expect(secondOffer.sellAmount_.toString()).to.eq(second_offer_pay_amt)
        expect(secondOffer.sellAmountInitial_.toString()).to.eq(second_offer_pay_amt)
        expect(secondOffer.buyToken_).to.eq(erc20DAI.address)
        expect(secondOffer.buyAmount_.toString()).to.eq(second_offer_buy_amt)
        expect(secondOffer.buyAmountInitial_.toString()).to.eq(second_offer_buy_amt)
        expect(secondOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(secondOffer.state_).to.eq(OFFER_STATE_ACTIVE)
        expect(secondOffer.feeSchedule_).to.eq(FEE_SCHEDULE_STANDARD)

        const secondSiblings = await market.getOfferSiblings(2)
        expect(secondSiblings.nextOfferId_.toNumber()).to.eq(0)
        expect(secondSiblings.prevOfferId_.toNumber()).to.eq(1)

      })
    })

    describe('isActive', () => {
      it('should get correct active status for offer', async () => {
        const firstOfferState = await market.isActive(1)
        expect(firstOfferState).to.be.equal(true)

        const secondOfferState = await market.isActive(2)
        expect(secondOfferState).to.be.equal(true)
      })
    })

    describe('cancel', () => {
      it('should fail to cancel unless called by offer owner', async () => {
        await market.cancel(2, { from: accounts[1] }).should.be.rejectedWith('only creator can cancel')
      })

      it('should allow offer owner to cancel offer successfully', async () => {
        await market.cancel(2, { from: accounts[2] }).should.be.fulfilled

        const secondOfferState = await market.isActive(2)
        expect(secondOfferState).to.be.equal(false)

        await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())

      })

      it('should delete cancelled offer successfully', async () => {
        await market.cancel(2, { from: accounts[2] }).should.be.fulfilled

        const secondOffer = await market.getOffer(2)
        expect(secondOffer.creator_).to.eq(accounts[2])
        expect(secondOffer.sellToken_).to.eq(erc20WETH.address)
        expect(secondOffer.sellAmount_.toString()).to.eq(second_offer_pay_amt)
        expect(secondOffer.sellAmountInitial_.toString()).to.eq(second_offer_pay_amt)
        expect(secondOffer.buyToken_).to.eq(erc20DAI.address)
        expect(secondOffer.buyAmount_.toString()).to.eq(second_offer_buy_amt)
        expect(secondOffer.buyAmountInitial_.toString()).to.eq(second_offer_buy_amt)
        expect(secondOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(secondOffer.state_).to.eq(OFFER_STATE_CANCELLED)
        expect(secondOffer.feeSchedule_).to.eq(FEE_SCHEDULE_STANDARD)

        const secondSiblings = await market.getOfferSiblings(2)
        expect(secondSiblings.nextOfferId_.toNumber()).to.eq(0)
        expect(secondSiblings.prevOfferId_.toNumber()).to.eq(0)
      })
    })

    describe('buy', () => {
      it('should fail to buy if offer is cancelled', async () => {
        await market.cancel(2, { from: accounts[2] }).should.be.fulfilled

        const secondOfferState = await market.isActive(2)
        expect(secondOfferState).to.be.equal(false)

        await market.buy(2, toWei('20'), { from: accounts[3] }).should.be.rejectedWith('revert')

        await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
      })

      it('should fail to buy successfully if amount is zero', async () => {
        await market.isActive(1).should.eventually.eq(true)

        await erc20DAI.approve(
          market.address,
          toWei('20'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await market.buy(1, 0, { from: accounts[3] }).should.be.rejectedWith('revert')

        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())

        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1000').toString())
      })

      it('should fail to buy successfully if amount is not approved by buyer', async () => {
        await market.isActive(1).should.eventually.eq(true)

        await erc20DAI.approve(
          market.address,
          0,
          { from: accounts[3] }
        ).should.be.fulfilled

        await market.buy(1, toWei('1'), { from: accounts[3] }).should.be.rejectedWith('revert')
      })

      it('should buy 50% or part of first offer successfully with 1:2 price ratio', async () => {
        await market.isActive(1).should.eventually.eq(true)

        const pay_amt = toWei('10')
        const buy_amt = toWei('20')

        await erc20DAI.approve(
          market.address,
          toWei('10'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await market.buy(1, toBN(buy_amt * 0.5), { from: accounts[3] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())

        const firstOffer = await market.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])
        expect(firstOffer.sellToken_).to.eq(erc20WETH.address)
        expect(firstOffer.sellAmount_.toString()).to.eq(`${first_offer_pay_amt / 2}`)
        expect(firstOffer.sellAmountInitial_.toString()).to.eq(first_offer_pay_amt)
        expect(firstOffer.buyToken_).to.eq(erc20DAI.address)
        expect(firstOffer.buyAmount_.toString()).to.eq(`${first_offer_buy_amt / 2}`)
        expect(firstOffer.buyAmountInitial_.toString()).to.eq(first_offer_buy_amt)
      })

      it('should buy all of first offer successfully with 1:2 price ratio in two buy transactions', async () => {
        await market.isActive(1).should.eventually.eq(true)

        const pay_amt = toWei('10')
        const buy_amt = toWei('20')

        await erc20DAI.approve(
          market.address,
          toWei('10'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await market.buy(1, toBN(buy_amt * 0.5), { from: accounts[3] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())

        await erc20DAI.approve(
          market.address,
          toWei('10'),
          { from: accounts[4] }
        ).should.be.fulfilled

        await market.buy(1, toBN(buy_amt * 0.5), { from: accounts[4] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
        await erc20WETH.balanceOf(accounts[4]).should.eventually.eq(toWei('1005').toString())
        await erc20DAI.balanceOf(accounts[4]).should.eventually.eq(toWei('990').toString())

        const firstOffer = await market.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])
        expect(firstOffer.sellToken_).to.eq(erc20WETH.address)
        expect(firstOffer.sellAmount_.toString()).to.eq(`0`)
        expect(firstOffer.sellAmountInitial_.toString()).to.eq(first_offer_pay_amt)
        expect(firstOffer.buyToken_).to.eq(erc20DAI.address)
        expect(firstOffer.buyAmount_.toString()).to.eq(`0`)
        expect(firstOffer.buyAmountInitial_.toString()).to.eq(first_offer_buy_amt)
        expect(firstOffer.state_).to.eq(OFFER_STATE_FULFILLED)
      })

      it('should set offer status to fulfilled and delete it if pay amount is all bought', async () => {
        await market.isActive(1).should.eventually.eq(true)

        const pay_amt = toWei('10')
        const buy_amt = toWei('20')

        await erc20DAI.approve(
          market.address,
          toWei('20'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await market.buy(1, toBN(buy_amt), { from: accounts[3] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1010').toString())
        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('980').toString())

        const firstOffer = await market.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])
        expect(firstOffer.sellToken_).to.eq(erc20WETH.address)
        expect(firstOffer.sellAmount_.toNumber()).to.eq(0)
        expect(firstOffer.sellAmountInitial_.toString()).to.eq(`${first_offer_pay_amt}`)
        expect(firstOffer.buyToken_).to.eq(erc20DAI.address)
        expect(firstOffer.buyAmount_.toNumber()).to.eq(0)
        expect(firstOffer.buyAmountInitial_.toString()).to.eq(`${first_offer_buy_amt}`)
        expect(firstOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(firstOffer.state_).to.eq(OFFER_STATE_FULFILLED)

        const firstOfferSiblings = await market.getOfferSiblings(1)
        expect(firstOfferSiblings.nextOfferId_.toNumber()).to.eq(0)
        expect(firstOfferSiblings.prevOfferId_.toNumber()).to.eq(0)

        await market.isActive(1).should.eventually.eq(false)
      })
    })
  })

  describe('supports executeMarketOffer to sell all amount', () => {
    beforeEach(async () => {
      await erc20DAI.approve( market.address, toWei('30'), { from: accounts[3] } )
      // 20 DAI <-> 10 WETH (2 DAI per WETH)
      await market.executeLimitOffer( erc20DAI.address, toWei('20'), erc20WETH.address, toWei('10'), FEE_SCHEDULE_STANDARD, { from: accounts[3] } )
      // 10 DAI <-> 10 WETH (1 DAI per WETH)
      await market.executeLimitOffer( erc20DAI.address, toWei('10'), erc20WETH.address, toWei('10'), FEE_SCHEDULE_STANDARD, { from: accounts[3] } )
    })

    it('should revert if amount to sell cannot be transferred from user', async () => {
      await erc20WETH.approve( market.address, toBN(5e18), { from: accounts[1] } )

      await market.executeMarketOffer(erc20WETH.address,
        toBN(11e18), erc20DAI.address, { from: accounts[1] }).should.be.rejectedWith('DummyToken: transfer amount exceeds allowance')
    });

    describe('pre-calculation', () => {
      it('when there are no orders in market to match', async () => {
        await market.simulateMarketOffer(erc20DAI.address, toBN(11e18), erc20WETH.address).should.be.rejectedWith('not enough orders in market');
      })

      it('when there are not enough orders in market to match', async () => {
        await market.simulateMarketOffer(erc20WETH.address, toBN(50e18), erc20DAI.address).should.be.rejectedWith('not enough orders in market')
      })

      it('when it can partially match an existing offer', async () => {
        await market.simulateMarketOffer(erc20WETH.address, toBN(5e18), erc20DAI.address).should.eventually.eq(toBN(10e18))
      })

      it('when it fully matches an existing offer', async () => {
        await market.simulateMarketOffer(erc20WETH.address, toBN(10e18), erc20DAI.address).should.eventually.eq(toBN(20e18))
      })

      it('when it fully matches an existing offer and partially matches a second offer', async () => {
        await market.simulateMarketOffer(erc20WETH.address, toBN(12e18), erc20DAI.address).should.eventually.eq(toBN(22e18))
      })

      it('when it fully matches existing offers', async () => {
        await market.simulateMarketOffer(erc20WETH.address, toBN(20e18), erc20DAI.address).should.eventually.eq(toBN(30e18))
      })
    })

    it('should revert if there are no orders in market to match', async () => {
      await erc20WETH.approve( market.address, toBN(5e18), { from: accounts[1] } )

      await market.executeMarketOffer(erc20DAI.address,
        toBN(11e18), erc20WETH.address, { from: accounts[1] }).should.be.rejectedWith('not enough orders in market')

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('970').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1000').toString())
    })

    it('should revert if there are not enough orders in market to match', async () => {
      await erc20WETH.approve(market.address, toBN(50e18), { from: accounts[1] })
      await market.executeMarketOffer(erc20WETH.address, toBN(50e18), erc20DAI.address, { from: accounts[1] }).should.be.rejectedWith('not enough orders in market')
    })

    it('should match top market offer partly when offer cannot be fully matched by counter offer', async () => {
      // buyer must have approved WETH to get DAI at best offer
      await erc20WETH.approve( market.address, toBN(5e18), { from: accounts[1] } )
      await market.executeMarketOffer(erc20WETH.address, toBN(5e18), erc20DAI.address, { from: accounts[1] })

      await market.getOffer(1).should.eventually.matchObj({
        sellAmount_: toBN(10e18), // prev 20
        buyAmount_: toBN(5e18), // prev 10
      })

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('995').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('970').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
    })

    it('should match top market offers partly when offer cannot be fully matched by all offers', async () => {
      // buyer must have approved WETH to get DAI at best offer
      await erc20WETH.approve( market.address, toBN(15e18), { from: accounts[1] } )
      await market.executeMarketOffer(erc20WETH.address, toBN(15e18), erc20DAI.address, { from: accounts[1] })

      await market.getOffer(1).should.eventually.matchObj({
        sellAmount_: toBN(0),
        buyAmount_: toBN(0),
      })

      await market.getOffer(2).should.eventually.matchObj({
        sellAmount_: toBN(5e18),
        buyAmount_: toBN(5e18),
      })

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1025').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('985').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('970').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1015').toString())
    })

    it('should match top market offer fully when an offer can be fully matched by counter offer', async () => {
      await erc20WETH.approve( market.address, toBN(10e18), { from: accounts[1] } )

      await market.executeMarketOffer(erc20WETH.address, toBN(10e18), erc20DAI.address, { from: accounts[1] })

      await market.getOffer(1).should.eventually.matchObj({
        sellAmount_: toBN(0), // prev 20
        buyAmount_: toBN(0), // prev 10
      })

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('970').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1010').toString())
    })

    it('should match top market offers fully when offer can be fully matched by all offers', async () => {
      // buyer must have approved WETH to get DAI at best offer
      await erc20WETH.approve(market.address, toBN(20e18), { from: accounts[1] })
      await market.executeMarketOffer(erc20WETH.address, toBN(20e18), erc20DAI.address, { from: accounts[1] })

      await market.getOffer(1).should.eventually.matchObj({
        sellAmount_: toBN(0), // prev 20
        buyAmount_: toBN(0), // prev 10
      })

      await market.getOffer(2).should.eventually.matchObj({
        sellAmount_: toBN(0), // prev 10
        buyAmount_: toBN(0), // prev 10
      })

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1030').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('980').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('970').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1020').toString())
    })
  })

  describe('can match a pair of matching offers', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('5');

      await erc20DAI.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        first_offer_pay_amt,
        erc20WETH.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        second_offer_pay_amt,
        erc20DAI.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD, 
        { from: accounts[2] }
      )
    })

    it('get correct last offer id after creating offers', async () => {
      await market.getLastOfferId().should.eventually.eq(2)
    })

    it('should match both matching offers partly and get correct last offer id after complete and active offers', async () => {
      const firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0) // previously 10
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0) // previously 5

      const secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('5')) // previously 10
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('10')) // previously 20

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1005').toString())

      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('990').toString())
    })

  })

  describe('can match multiple or more than two matching offers simultaneously', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('20');
      first_offer_buy_amt = toWei('40');

      await erc20DAI.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        first_offer_pay_amt,
        erc20WETH.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        second_offer_pay_amt,
        erc20DAI.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      )
    })

    it('get correct last offer id after creating offers', async () => {
      await market.getLastOfferId().should.eventually.eq(2)
    })

    it('create and match two more offers with one previous matching offer, i.e., offer 2', async () => {
      let third_offer_pay_amt;
      let third_offer_buy_amt;
      let fourth_offer_pay_amt;
      let fourth_offer_buy_amt;

      third_offer_pay_amt = toWei('40')
      third_offer_buy_amt = toWei('20')

      await erc20DAI.approve(
        market.address,
        third_offer_pay_amt,
        { from: accounts[3] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        third_offer_pay_amt,
        erc20WETH.address,
        third_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[3] }
      )

      await market.getLastOfferId().should.eventually.eq(3)

      fourth_offer_pay_amt = toWei('5');
      fourth_offer_buy_amt = toWei('10');

      await erc20WETH.approve(
        market.address,
        fourth_offer_pay_amt,
        { from: accounts[4] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        fourth_offer_pay_amt,
        erc20DAI.address,
        fourth_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[4] }
      )

      // last offer id will not create a new offer for matched offer after remaining amounts not > 0
      // but e.g., will create new offer for the following example amounts to make getLastOfferId return 4
      // fourth_offer_pay_amt = toWei('30');
      // fourth_offer_buy_amt = toWei('60');
      await market.getLastOfferId().should.eventually.eq(3)

      const secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toNumber()).to.eq(0)
      expect(secondOffer.buyAmount_.toNumber()).to.eq(0)

      const thirdOffer = await market.getOffer(3)
      expect(thirdOffer.sellAmount_.toString()).to.eq(toWei('10')) // previously 40
      expect(thirdOffer.buyAmount_.toString()).to.eq(toWei('5')) // previously 20

      const fourthOffer = await market.getOffer(4)
      expect(fourthOffer.sellAmount_.toNumber()).to.eq(0)  // previously 5
      expect(fourthOffer.buyAmount_.toNumber()).to.eq(0) // previously 10

      await market.getLastOfferId().should.eventually.eq(3)

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1020').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('990').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('960').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1015').toString())

      await erc20DAI.balanceOf(accounts[4]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[4]).should.eventually.eq(toWei('995').toString())
    })
  })

  describe('should get correct last offer id when second matching offer not completely filled', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('5');

      await erc20DAI.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        first_offer_pay_amt,
        erc20WETH.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        second_offer_pay_amt,
        erc20DAI.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      )

      const firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)  // previously 10
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0) // previously 5

      const secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('5')) // previously 10
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('10')) // previously 20
    })

    it('should get correct balances after creating offers', async () => {
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1005').toString())

      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('990').toString())
    })

  })

  describe('should get correct last offer id when second matching offer is completely filled', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('5');

      await erc20DAI.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        first_offer_pay_amt,
        erc20WETH.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('5');
      second_offer_buy_amt = toWei('10');

      await erc20WETH.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        second_offer_pay_amt,
        erc20DAI.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      )

      const firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)  // previously 10
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0) // previously 5

      const secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toNumber()).to.eq(0)  // previously 5
      expect(secondOffer.buyAmount_.toNumber()).to.eq(0) // previously 10

    })

    it('should get correct last offer id after creating offers', async () => {
      await market.getLastOfferId().should.eventually.eq(1)
    })

    it('should get correct balances after matching offers', async () => {
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1005').toString())

      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('995').toString())

    })

  })

  describe('can find the best offer id for a token pair', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('20');
      first_offer_buy_amt = toWei('40');

      await erc20DAI.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        first_offer_pay_amt,
        erc20WETH.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('20');
      second_offer_buy_amt = toWei('30');

      await erc20DAI.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        second_offer_pay_amt,
        erc20WETH.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      )
    })

    it('get correct last offer id after creating offers', async () => {
      await market.getLastOfferId().should.eventually.eq(2)
    })

    it('should not match the two created offers if the prices do not match', async () => {
      const firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('20'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('40'))

      const secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('20'))
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('30'))


      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())

    })

    it('should get the id of the best offer if available', async () => {
      await market.getBestOfferId(erc20DAI.address, erc20WETH.address).should.eventually.eq(2)
    })

    it('should return 0 when there is no best offer for a token pair', async () => {
      await market.getBestOfferId(erc20WETH.address, erc20DAI.address).should.eventually.eq(0)
    })

  })

  describe('handleTrade and handleClosure should handle trade or closure or cancellation notifications in market observer', () => {
    let marketObserver;
    let notifyData = toHex('nayms')
    const orderType = {
      none: 0,
      trade: 1,
      closure: 2
    }

    beforeEach(async () => {
      marketObserver = await DummyMarketObserver.new({ from: accounts[0] })
    })

    it('should deploy market observer correctly', async () => {
      (marketObserver.address).should.not.equal(ADDRESS_ZERO)
      const orderInfo = await marketObserver.getOrder(3)
      expect((orderInfo._type).toNumber()).to.be.eq(0)
      expect(orderInfo._data).to.be.eq(null)
    })

    it('should get correct order info for created orders when no trade or closure occurs', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('10')

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      const second_offer_pay_amt = toWei('10')
      const second_offer_buy_amt = toWei('10')

      await erc20WETH.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        second_offer_pay_amt,
        erc20DAI.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[2] }
      )

      const firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(0)
      expect(firstOrderInfo._data).to.be.eq(null)

      const secondOrderInfo = await marketObserver.getOrder(2)
      expect((secondOrderInfo._type).toNumber()).to.be.eq(0)
      expect(secondOrderInfo._data).to.be.eq(null)

      const firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('10'))

      const secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('10'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
    })

    it('should implement IMarketObserver', async () => {
      const FUNC_SIGNATURE = "handleTrade(uint256,uint256,uint256,address,uint256,address,bytes)";
      // const funcSelector = web3.sha3(FUNC_SIGNATURE).slice(2,10); // Truffle v4.x / Web3 v0.x
      const funcSelector = web3.utils.keccak256(FUNC_SIGNATURE).slice(2, 10); // Truffle v5.x / Web3 v1.x
      const bytecode = await web3.eth.getCode(marketObserver.address);
      expect(bytecode.includes(funcSelector)).to.be.eq(true);
    })

    it('should handle order closures for fully matching offers and get correct order info after closure occurs', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('10')

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      const second_offer_pay_amt = toWei('10')
      const second_offer_buy_amt = toWei('10')

      await erc20DAI.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20DAI.address,
        second_offer_pay_amt,
        erc20WETH.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[2] }
      )

      const firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.closure)
      expect(firstOrderInfo._data).to.be.eq(notifyData)

      const secondOrderInfo = await marketObserver.getOrder(2)
      expect((secondOrderInfo._type).toNumber()).to.be.eq(orderType.none)
      expect(secondOrderInfo._data).to.be.eq(null)

      const firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0)

      const secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toNumber()).to.eq(0)
      expect(secondOffer.buyAmount_.toNumber()).to.eq(0)


      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())

      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('990').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1010').toString())
    })

    it('should handle multiple offers, trade, closure and return order info of created order that did not fully sell', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('20')

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      const second_offer_pay_amt = toWei('40')
      const second_offer_buy_amt = toWei('20')

      await erc20DAI.approve(
        market.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20DAI.address,
        second_offer_pay_amt,
        erc20WETH.address,
        second_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[2] }
      )

      const firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.closure)
      expect(firstOrderInfo._data).to.be.eq(notifyData)

      // bought order id is the one that's sent to observer in notification
      let secondOrderInfo = await marketObserver.getOrder(2)
      expect((secondOrderInfo._type).toNumber()).to.be.eq(orderType.none)
      expect(secondOrderInfo._data).to.be.eq(null)

      const firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0)

      let secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('20'))
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('10'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())

      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1010').toString())
      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('960').toString())

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      const thirdOrderInfo = await marketObserver.getOrder(3)
      expect((thirdOrderInfo._type).toNumber()).to.be.eq(orderType.none)
      expect(thirdOrderInfo._data).to.be.eq(null)

      secondOrderInfo = await marketObserver.getOrder(2)
      expect((secondOrderInfo._type).toNumber()).to.be.eq(orderType.closure)
      expect(secondOrderInfo._data).to.be.eq(notifyData)

      const thirdOffer = await market.getOffer(3)
      expect(thirdOffer.sellAmount_.toNumber()).to.eq(0)
      expect(thirdOffer.buyAmount_.toNumber()).to.eq(0)

      secondOffer = await market.getOffer(2)
      expect(secondOffer.sellAmount_.toNumber()).to.eq(0)
      expect(secondOffer.buyAmount_.toNumber()).to.eq(0)

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('980').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1040').toString())

      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1020').toString())
      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('960').toString())
    })

    it('should handle order cancellation', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('20')

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      // no matching offer
      let firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.none)
      expect(firstOrderInfo._data).to.be.eq(null)

      let firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())


      await market.cancel(1, { from: accounts[1] }).should.be.fulfilled

      firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.closure)
      expect(firstOrderInfo._data).to.be.eq(notifyData)

      firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))
      
      const firstOfferState = await market.isActive(1)
      expect(firstOfferState).to.be.equal(false)

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
    })

    it('should handle order cancellation without notify data', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('20')

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        BYTES_ZERO,
        { from: accounts[1] }
      )

      let firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.none)
      expect(firstOrderInfo._data).to.be.eq(null)

      let firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await market.cancel(1, { from: accounts[1] }).should.be.fulfilled

      firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.closure)
      expect(firstOrderInfo._data).to.be.eq("0x00")

      firstOffer = await market.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))
      
      const firstOfferState = await market.isActive(1)
      expect(firstOfferState).to.be.equal(false)

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
    })

    it('should handle trade after a buy', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('20')

      await erc20WETH.approve(
        market.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        FEE_SCHEDULE_STANDARD,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )


      const firstOfferState = await market.isActive(1)
      expect(firstOfferState).to.be.equal(true)

      await erc20DAI.approve(
        market.address,
        toWei('10'),
        { from: accounts[3] }
      ).should.be.fulfilled

      await market.buy(1, toBN(first_offer_buy_amt * 0.5), { from: accounts[3] })

      const firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.trade)
      expect(firstOrderInfo._data).to.be.eq(notifyData)

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - first_offer_pay_amt).toString()) // pay_amt collected upon making offer
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())
    })
  })

  describe('with fees turned on', () => {
    beforeEach(async () => {
      await market.setFee(2000 /* 20% */)
    })

    it('subtracts fees from the take, but not the make', async () => {
      // make order: 10 WETH for 5 DAI
      await erc20WETH.approve(
        market.address,
        toWei('10'),
        { from: accounts[1] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        toWei('10'),
        erc20DAI.address,
        toWei('5'),
        FEE_SCHEDULE_STANDARD,
        { from: accounts[1] }
      )

      // check balances
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
      await erc20WETH.balanceOf(market.address).should.eventually.eq(toWei('10').toString())
      await erc20DAI.balanceOf(market.address).should.eventually.eq(toWei('0').toString())

      // take order: 10 DAI for 20 WETH
      await erc20DAI.approve(
        market.address,
        toWei('12'), /* 10 DAI + 20% max taker fee */
        { from: accounts[2] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20DAI.address,
        toWei('10'),
        erc20WETH.address,
        toWei('20'),
        FEE_SCHEDULE_STANDARD,
        { from: accounts[2] }
      )

      // check balances
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1005').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1010').toString())
      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('989').toString()) /* actual fee paid was only 1 DAI, hence */
      await erc20WETH.balanceOf(market.address).should.eventually.eq(toWei('0').toString())
      await erc20DAI.balanceOf(market.address).should.eventually.eq(toWei('5').toString())

      // now take second order with: 10 ETH for 5 DAI
      await erc20WETH.approve(
        market.address,
        toWei('10'),
        { from: accounts[3] }
      ).should.be.fulfilled

      await market.executeLimitOffer(
        erc20WETH.address,
        toWei('10'),
        erc20DAI.address,
        toWei('5'),
        FEE_SCHEDULE_STANDARD,
        { from: accounts[3] }
      )

      // check balances
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1005').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1020').toString())
      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('989').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('1004').toString()) /* paid 1 DAI taker fee */
      await erc20WETH.balanceOf(market.address).should.eventually.eq(toWei('0').toString())
      await erc20DAI.balanceOf(market.address).should.eventually.eq(toWei('0').toString())
    })
  })
})
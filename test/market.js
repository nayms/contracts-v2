import { extractEventArgs, ADDRESS_ZERO, BYTES_ZERO, EvmSnapshot } from './utils/index'
import { toBN, toWei, toHex } from './utils/web3'
import { events } from '..'

import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'

const DummyToken = artifacts.require("./DummyToken")
const DummyMarketObserver = artifacts.require("./DummyMarketObserver")

contract('Market', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let settings
  //let market
  let acl
  let systemContext

  let matchingMarketInstance
  let erc20WETH
  let erc20DAI
  let mintAmount

  before(async () => {
    erc20WETH = await DummyToken.new('Wrapped ETH', 'WETH', 18, 0, { from: accounts[0] })
    erc20DAI = await DummyToken.new('Dai Stablecoin', 'DAI', 18, 0, { from: accounts[0] })
    mintAmount = toWei('1000')

    for (let i = 1; i <= 4; i++) {
      await erc20WETH.mint(mintAmount, { from: accounts[i] })
      await erc20DAI.mint(mintAmount, { from: accounts[i] })
    }

    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // market
    matchingMarketInstance = await ensureMarketIsDeployed({ artifacts, settings })
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('deployment checks', () => {
    it('should return deployed market address and not zero address', async () => {
      (matchingMarketInstance.address).should.not.equal(ADDRESS_ZERO)
    })
  })

  describe('last offer id', () => {
    it('get correct last offer id before creation of offers', async () => {
      await matchingMarketInstance.getLastOfferId().should.eventually.eq(0)
    })

    it('get correct last offer id before creation of one offer', async () => {
      const pay_amt = toWei('10')
      const buy_amt = toWei('10')

      await erc20WETH.approve(
        matchingMarketInstance.address,
        pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      const offerTx = await matchingMarketInstance.executeLimitOffer(
        erc20WETH.address,
        pay_amt,
        erc20DAI.address,
        buy_amt,
        { from: accounts[2] }
      )

      await matchingMarketInstance.getLastOfferId().should.eventually.eq(1)
    })
  })

  describe('supports getOffer, isActive and cancel', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;
    let firstOfferTx;
    let secondOfferTx;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      firstOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20WETH.address,
        first_offer_pay_amt,

        erc20DAI.address,
        first_offer_buy_amt,

        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('10');

      await erc20WETH.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      secondOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20WETH.address,
        second_offer_pay_amt,

        erc20DAI.address,
        second_offer_buy_amt,

        { from: accounts[2] }
      )

      // const eventArgs = extractEventArgs(secondOfferTx, events.LogUnsortedOffer)
      // expect(eventArgs).to.include({ id: '2' })
    })

    it('get correct last offer id after creation of offers', async () => {
      await matchingMarketInstance.getLastOfferId().should.eventually.eq(2)
    })

    it('should get correct offer owners balances after offers', async () => {
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - first_offer_pay_amt).toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq((mintAmount - second_offer_pay_amt).toString())
    })

    describe('getOwner', () => {
      it('should get correct offer owners', async () => {
        const firstOffer = await matchingMarketInstance.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])

        const secondOffer = await matchingMarketInstance.getOffer(2)
        expect(secondOffer.creator_).to.eq(accounts[2])
      })

    })

    describe('getOffer', () => {
      it('should get correct offer details for non-matching offers without matching them', async () => {
        const firstOffer = await matchingMarketInstance.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])
        expect(firstOffer.sellToken_).to.eq(erc20WETH.address)
        expect(firstOffer.sellAmount_.toString()).to.eq(first_offer_pay_amt)
        expect(firstOffer.buyToken_).to.eq(erc20DAI.address)
        expect(firstOffer.buyAmount_.toString()).to.eq(first_offer_buy_amt)
        expect(firstOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(firstOffer.isActive_).to.eq(true)
        expect(firstOffer.nextOfferId_.toNumber()).to.eq(2)
        expect(firstOffer.prevOfferId_.toNumber()).to.eq(0)

        const secondOffer = await matchingMarketInstance.getOffer(2)
        expect(secondOffer.creator_).to.eq(accounts[2])
        expect(secondOffer.sellToken_).to.eq(erc20WETH.address)
        expect(secondOffer.sellAmount_.toString()).to.eq(second_offer_pay_amt)
        expect(secondOffer.buyToken_).to.eq(erc20DAI.address)
        expect(secondOffer.buyAmount_.toString()).to.eq(second_offer_buy_amt)
        expect(secondOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(secondOffer.isActive_).to.eq(true)
        expect(secondOffer.nextOfferId_.toNumber()).to.eq(0)
        expect(secondOffer.prevOfferId_.toNumber()).to.eq(1)

      })
    })

    describe('isActive', () => {
      it('should get correct active status for offer', async () => {
        const firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(true)

        const secondOfferActive = await matchingMarketInstance.isActive(2)
        expect(secondOfferActive).to.be.equal(true)
      })
    })

    describe('cancel', () => {
      it('should fail to cancel unless called by offer owner', async () => {
        await matchingMarketInstance.cancel(2, { from: accounts[1] }).should.be.rejectedWith('only creator can cancel')
      })

      it('should allow offer owner to cancel offer successfully', async () => {
        await matchingMarketInstance.cancel(2, { from: accounts[2] }).should.be.fulfilled

        const secondOfferActive = await matchingMarketInstance.isActive(2)
        expect(secondOfferActive).to.be.equal(false)

        await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())

      })

      it('should delete cancelled offer successfully', async () => {
        await matchingMarketInstance.cancel(2, { from: accounts[2] }).should.be.fulfilled

        const secondOffer = await matchingMarketInstance.getOffer(2)
        expect(secondOffer.creator_).to.eq(accounts[2])
        expect(secondOffer.sellToken_).to.eq(erc20WETH.address)
        expect(secondOffer.sellAmount_.toString()).to.eq(second_offer_pay_amt)
        expect(secondOffer.buyToken_).to.eq(erc20DAI.address)
        expect(secondOffer.buyAmount_.toString()).to.eq(second_offer_buy_amt)
        expect(secondOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(secondOffer.isActive_).to.eq(false)
        expect(secondOffer.nextOfferId_.toNumber()).to.eq(0)
        expect(secondOffer.prevOfferId_.toNumber()).to.eq(0)
      })
    })

    describe('buy', () => {
      it('should fail to buy if offer is cancelled', async () => {
        await matchingMarketInstance.cancel(2, { from: accounts[2] }).should.be.fulfilled

        const secondOfferActive = await matchingMarketInstance.isActive(2)
        expect(secondOfferActive).to.be.equal(false)
        await matchingMarketInstance.buy(2, toWei('20'), { from: accounts[3] }).should.be.rejectedWith('revert')

        await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
      })

      it('should fail to buy successfully if amount is zero', async () => {
        const firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(true)

        await erc20DAI.approve(
          matchingMarketInstance.address,
          toWei('20'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await matchingMarketInstance.buy(1, 0, { from: accounts[3] }).should.be.rejectedWith('revert')

        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())

        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('1000').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1000').toString())
      })

      it('should fail to buy successfully if amount is not approved by buyer', async () => {
        const firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(true)

        await erc20DAI.approve(
          matchingMarketInstance.address,
          0,
          { from: accounts[3] }
        ).should.be.fulfilled

        await matchingMarketInstance.buy(1, toWei('1'), { from: accounts[3] }).should.be.rejectedWith('revert')
      })

      it('should buy 50% or part of first offer successfully with 1:2 price ratio', async () => {
        const firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(true)

        const pay_amt = toWei('10')
        const buy_amt = toWei('20')

        await erc20DAI.approve(
          matchingMarketInstance.address,
          toWei('10'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await matchingMarketInstance.buy(1, toBN(buy_amt * 0.5), { from: accounts[3] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())
      })

      it('should buy all of first offer successfully with 1:2 price ratio in two buy transactions', async () => {
        const firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(true)

        const pay_amt = toWei('10')
        const buy_amt = toWei('20')

        await erc20DAI.approve(
          matchingMarketInstance.address,
          toWei('10'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await matchingMarketInstance.buy(1, toBN(buy_amt * 0.5), { from: accounts[3] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())

        await erc20DAI.approve(
          matchingMarketInstance.address,
          toWei('10'),
          { from: accounts[4] }
        ).should.be.fulfilled

        await matchingMarketInstance.buy(1, toBN(buy_amt * 0.5), { from: accounts[4] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
        await erc20WETH.balanceOf(accounts[4]).should.eventually.eq(toWei('1005').toString())
        await erc20DAI.balanceOf(accounts[4]).should.eventually.eq(toWei('990').toString())

      })

      it('should set offer status to inactive if pay amount is all bought', async () => {
        let firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(true)

        const pay_amt = toWei('10')
        const buy_amt = toWei('20')

        await erc20DAI.approve(
          matchingMarketInstance.address,
          toWei('20'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await matchingMarketInstance.buy(1, toBN(buy_amt), { from: accounts[3] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1010').toString())
        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('980').toString())

        firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(false)
      })

      it('should delete fully bought offer successfully', async () => {
        const firstOfferActive = await matchingMarketInstance.isActive(1)
        expect(firstOfferActive).to.be.equal(true)

        const pay_amt = toWei('10')
        const buy_amt = toWei('20')

        await erc20DAI.approve(
          matchingMarketInstance.address,
          toWei('20'),
          { from: accounts[3] }
        ).should.be.fulfilled

        await matchingMarketInstance.buy(1, toBN(buy_amt), { from: accounts[3] })

        await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
        await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
        await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1010').toString())
        await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('980').toString())

        const firstOffer = await matchingMarketInstance.getOffer(1)
        expect(firstOffer.creator_).to.eq(accounts[1])
        expect(firstOffer.sellToken_).to.eq(erc20WETH.address)
        expect(firstOffer.sellAmount_.toNumber()).to.eq(0)
        expect(firstOffer.buyToken_).to.eq(erc20DAI.address)
        expect(firstOffer.buyAmount_.toNumber()).to.eq(0)
        expect(firstOffer.notify_).to.eq(ADDRESS_ZERO)
        expect(firstOffer.isActive_).to.eq(false)
        expect(firstOffer.nextOfferId_.toNumber()).to.eq(0)
        expect(firstOffer.prevOfferId_.toNumber()).to.eq(0)
      })
    })

  })

  describe('supports executeMarketOffer to sell all amount', () => {
    let pay_amt;
    let buy_amt;
    let second_offerTx;

    beforeEach(async () => {
      pay_amt = toWei('20');
      buy_amt = toWei('10');

      await erc20DAI.approve(
        matchingMarketInstance.address,
        pay_amt,
        { from: accounts[3] }
      ).should.be.fulfilled

      second_offerTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        pay_amt,

        erc20WETH.address,
        buy_amt,

        { from: accounts[3] }
      )
    })

    it('should revert if amount to sell cannot be transferred from user', async () => {
      await erc20WETH.approve(
        matchingMarketInstance.address,
        toBN(5e18),
        { from: accounts[1] }
      ).should.be.fulfilled

      await matchingMarketInstance.executeMarketOffer(erc20WETH.address,
        toBN(11e18), erc20DAI.address, { from: accounts[1] }).should.be.rejectedWith('DummyToken: transfer amount exceeds allowance')
    });

    it('should revert if not enough orders in market to fill amount to sell', async () => {
      await erc20WETH.approve(
        matchingMarketInstance.address,
        toBN(5e18),
        { from: accounts[1] }
      ).should.be.fulfilled

      await matchingMarketInstance.executeMarketOffer(erc20DAI.address,
        toBN(11e18), erc20WETH.address, { from: accounts[1] }).should.be.rejectedWith('not enough orders in market')

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1000').toString())

    })

    it('should match market offers partly when offer cannot be fully matched by counter offer', async () => {
      // buyer must have approved WETH to get DAI at best offer
      await erc20WETH.approve(
        matchingMarketInstance.address,
        toBN(5e18),
        { from: accounts[1] }
      ).should.be.fulfilled

      // caller must approve amount to give
      // calls buy function
      // Transfers funds from caller to offer maker, and from market to caller.
      await matchingMarketInstance.executeMarketOffer(erc20WETH.address,
        toBN(5e18), erc20DAI.address, { from: accounts[1] }).should.be.fulfilled

      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10')) // previously 20
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('5')) // previously 10

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('995').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
    })

    it('should match market offers fully when an offer can be fully matched by counter offer', async () => {
      await erc20WETH.approve(
        matchingMarketInstance.address,
        toBN(10e18),
        { from: accounts[1] }
      ).should.be.fulfilled

      await matchingMarketInstance.executeMarketOffer(erc20WETH.address,
        toBN(10e18), erc20DAI.address, { from: accounts[1] }).should.be.fulfilled

      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0) // previously 20
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0) // previously 10

      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())

      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1010').toString())
    })

  })

  describe('can match a pair of matching offers', () => {
    let first_offer_pay_amt;
    let second_offer_pay_amt;
    let first_offer_buy_amt;
    let second_offer_buy_amt;
    let firstOfferTx;
    let secondOfferTx;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('5');

      await erc20DAI.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      firstOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        first_offer_pay_amt,

        erc20WETH.address,
        first_offer_buy_amt,

        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      secondOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20WETH.address,
        second_offer_pay_amt,

        erc20DAI.address,
        second_offer_buy_amt,

        { from: accounts[2] }
      )
    })

    it('get correct last offer id after creating offers', async () => {
      await matchingMarketInstance.getLastOfferId().should.eventually.eq(2)
    })

    it('should match both matching offers partly and get correct last offer id after complete and active offers', async () => {
      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0) // previously 10
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0) // previously 5

      const secondOffer = await matchingMarketInstance.getOffer(2)
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
    let firstOfferTx;
    let secondOfferTx;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('20');
      first_offer_buy_amt = toWei('40');

      await erc20DAI.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      firstOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        first_offer_pay_amt,

        erc20WETH.address,
        first_offer_buy_amt,

        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      secondOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20WETH.address,
        second_offer_pay_amt,

        erc20DAI.address,
        second_offer_buy_amt,

        { from: accounts[2] }
      )
    })

    it('get correct last offer id after creating offers', async () => {
      await matchingMarketInstance.getLastOfferId().should.eventually.eq(2)
    })

    it('create and match two more offers with one previous matching offer, i.e., offer 2', async () => {
      let third_offer_pay_amt;
      let third_offer_buy_amt;
      let fourth_offer_pay_amt;
      let fourth_offer_buy_amt;

      third_offer_pay_amt = toWei('40')
      third_offer_buy_amt = toWei('20')

      await erc20DAI.approve(
        matchingMarketInstance.address,
        third_offer_pay_amt,
        { from: accounts[3] }
      ).should.be.fulfilled

      const thirdOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        third_offer_pay_amt,

        erc20WETH.address,
        third_offer_buy_amt,

        { from: accounts[3] }
      )

      await matchingMarketInstance.getLastOfferId().should.eventually.eq(3)

      fourth_offer_pay_amt = toWei('5');
      fourth_offer_buy_amt = toWei('10');

      await erc20WETH.approve(
        matchingMarketInstance.address,
        fourth_offer_pay_amt,
        { from: accounts[4] }
      ).should.be.fulfilled

      const fourthOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20WETH.address,
        fourth_offer_pay_amt,

        erc20DAI.address,
        fourth_offer_buy_amt,

        { from: accounts[4] }
      )

      // last offer id will not create a new offer for matched offer after remaining amounts not > 0
      // but e.g., will create new offer for the following example amounts to make getLastOfferId return 4
      // fourth_offer_pay_amt = toWei('30');
      // fourth_offer_buy_amt = toWei('60');
      await matchingMarketInstance.getLastOfferId().should.eventually.eq(3)

      const secondOffer = await matchingMarketInstance.getOffer(2)
      expect(secondOffer.sellAmount_.toNumber()).to.eq(0)
      expect(secondOffer.buyAmount_.toNumber()).to.eq(0)

      const thirdOffer = await matchingMarketInstance.getOffer(3)
      expect(thirdOffer.sellAmount_.toString()).to.eq(toWei('10')) // previously 40
      expect(thirdOffer.buyAmount_.toString()).to.eq(toWei('5')) // previously 20

      const fourthOffer = await matchingMarketInstance.getOffer(4)
      expect(fourthOffer.sellAmount_.toNumber()).to.eq(0)  // previously 5
      expect(fourthOffer.buyAmount_.toNumber()).to.eq(0) // previously 10

      await matchingMarketInstance.getLastOfferId().should.eventually.eq(3)

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
    let firstOfferTx;
    let secondOfferTx;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('5');

      await erc20DAI.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      firstOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        first_offer_pay_amt,

        erc20WETH.address,
        first_offer_buy_amt,

        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('10');
      second_offer_buy_amt = toWei('20');

      await erc20WETH.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      secondOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20WETH.address,
        second_offer_pay_amt,

        erc20DAI.address,
        second_offer_buy_amt,

        { from: accounts[2] }
      )

      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)  // previously 10
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0) // previously 5

      const secondOffer = await matchingMarketInstance.getOffer(2)
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
    let firstOfferTx;
    let secondOfferTx;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('10');
      first_offer_buy_amt = toWei('5');

      await erc20DAI.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      firstOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        first_offer_pay_amt,

        erc20WETH.address,
        first_offer_buy_amt,

        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('5');
      second_offer_buy_amt = toWei('10');

      await erc20WETH.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      secondOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20WETH.address,
        second_offer_pay_amt,

        erc20DAI.address,
        second_offer_buy_amt,
        { from: accounts[2] }
      )

      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)  // previously 10
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0) // previously 5

      const secondOffer = await matchingMarketInstance.getOffer(2)
      expect(secondOffer.sellAmount_.toNumber()).to.eq(0)  // previously 5
      expect(secondOffer.buyAmount_.toNumber()).to.eq(0) // previously 10

    })

    it('should get correct last offer id after creating offers', async () => {
      await matchingMarketInstance.getLastOfferId().should.eventually.eq(1)
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
    let firstOfferTx;
    let secondOfferTx;

    beforeEach(async () => {
      first_offer_pay_amt = toWei('20');
      first_offer_buy_amt = toWei('40');

      await erc20DAI.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      firstOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        first_offer_pay_amt,

        erc20WETH.address,
        first_offer_buy_amt,

        { from: accounts[1] }
      )

      second_offer_pay_amt = toWei('20');
      second_offer_buy_amt = toWei('30');

      await erc20DAI.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      secondOfferTx = await matchingMarketInstance.executeLimitOffer(

        erc20DAI.address,
        second_offer_pay_amt,

        erc20WETH.address,
        second_offer_buy_amt,

        { from: accounts[2] }
      )
    })

    it('get correct last offer id after creating offers', async () => {
      await matchingMarketInstance.getLastOfferId().should.eventually.eq(2)
    })

    it('should not match the two created offers if the prices do not match', async () => {
      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('20'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('40'))

      const secondOffer = await matchingMarketInstance.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('20'))
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('30'))


      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('980').toString())
      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())

    })

    it('should get the id of the best offer if available', async () => {
      await matchingMarketInstance.getBestOfferId(erc20DAI.address, erc20WETH.address).should.eventually.eq(2)
    })

    it('should return 0 when there is no best offer for a token pair', async () => {
      await matchingMarketInstance.getBestOfferId(erc20WETH.address, erc20DAI.address).should.eventually.eq(0)
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
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      const firstOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      const second_offer_pay_amt = toWei('10')
      const second_offer_buy_amt = toWei('10')

      await erc20WETH.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      const secondOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        second_offer_pay_amt,
        erc20DAI.address,
        second_offer_buy_amt,
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

      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('10'))

      const secondOffer = await matchingMarketInstance.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('10'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('1000').toString())
    })

    it('should implement IMarketObserver', async () => {
      const FUNC_SIGNATURE = "handleTrade(uint256,address,uint256,address,uint256,address,address,bytes)";
      // const funcSelector = web3.sha3(FUNC_SIGNATURE).slice(2,10); // Truffle v4.x / Web3 v0.x
      const funcSelector = web3.utils.keccak256(FUNC_SIGNATURE).slice(2, 10); // Truffle v5.x / Web3 v1.x
      const bytecode = await web3.eth.getCode(marketObserver.address);
      expect(bytecode.includes(funcSelector)).to.be.eq(true);
    })

    it('should handle order closures for fully matching offers and get correct order info after closure occurs', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('10')

      await erc20WETH.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      const firstOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      const second_offer_pay_amt = toWei('10')
      const second_offer_buy_amt = toWei('10')

      await erc20DAI.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      const secondOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20DAI.address,
        second_offer_pay_amt,
        erc20WETH.address,
        second_offer_buy_amt,
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

      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0)

      const secondOffer = await matchingMarketInstance.getOffer(2)
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
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      const firstOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      const second_offer_pay_amt = toWei('40')
      const second_offer_buy_amt = toWei('20')

      await erc20DAI.approve(
        matchingMarketInstance.address,
        second_offer_pay_amt,
        { from: accounts[2] }
      ).should.be.fulfilled

      const secondOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20DAI.address,
        second_offer_pay_amt,
        erc20WETH.address,
        second_offer_buy_amt,
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

      const firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toNumber()).to.eq(0)
      expect(firstOffer.buyAmount_.toNumber()).to.eq(0)

      let secondOffer = await matchingMarketInstance.getOffer(2)
      expect(secondOffer.sellAmount_.toString()).to.eq(toWei('20'))
      expect(secondOffer.buyAmount_.toString()).to.eq(toWei('10'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())

      await erc20WETH.balanceOf(accounts[2]).should.eventually.eq(toWei('1010').toString())
      await erc20DAI.balanceOf(accounts[2]).should.eventually.eq(toWei('960').toString())

      await erc20WETH.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      const thirdOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
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

      const thirdOffer = await matchingMarketInstance.getOffer(3)
      expect(thirdOffer.sellAmount_.toNumber()).to.eq(0)
      expect(thirdOffer.buyAmount_.toNumber()).to.eq(0)

      secondOffer = await matchingMarketInstance.getOffer(2)
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
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      const firstOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )

      // no matching offer
      let firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.none)
      expect(firstOrderInfo._data).to.be.eq(null)

      let firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())


      await matchingMarketInstance.cancel(1, { from: accounts[1] }).should.be.fulfilled

      firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.closure)
      expect(firstOrderInfo._data).to.be.eq(notifyData)

      firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))
      const firstOfferActive = await matchingMarketInstance.isActive(1)
      expect(firstOfferActive).to.be.equal(false)

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
    })

    it('should handle order cancellation without notify data', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('20')

      await erc20WETH.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      const firstOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        marketObserver.address,
        BYTES_ZERO,
        { from: accounts[1] }
      )

      let firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.none)
      expect(firstOrderInfo._data).to.be.eq(null)

      let firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())

      await matchingMarketInstance.cancel(1, { from: accounts[1] }).should.be.fulfilled

      firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.closure)
      expect(firstOrderInfo._data).to.be.eq("0x00")

      firstOffer = await matchingMarketInstance.getOffer(1)
      expect(firstOffer.sellAmount_.toString()).to.eq(toWei('10'))
      expect(firstOffer.buyAmount_.toString()).to.eq(toWei('20'))
      const firstOfferActive = await matchingMarketInstance.isActive(1)
      expect(firstOfferActive).to.be.equal(false)

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1000').toString())
    })

    it('should handle trade after a buy', async () => {
      const first_offer_pay_amt = toWei('10')
      const first_offer_buy_amt = toWei('20')

      await erc20WETH.approve(
        matchingMarketInstance.address,
        first_offer_pay_amt,
        { from: accounts[1] }
      ).should.be.fulfilled

      const firstOfferTx = await matchingMarketInstance.executeLimitOfferWithObserver(
        erc20WETH.address,
        first_offer_pay_amt,
        erc20DAI.address,
        first_offer_buy_amt,
        marketObserver.address,
        notifyData,
        { from: accounts[1] }
      )


      const firstOfferActive = await matchingMarketInstance.isActive(1)
      expect(firstOfferActive).to.be.equal(true)

      await erc20DAI.approve(
        matchingMarketInstance.address,
        toWei('10'),
        { from: accounts[3] }
      ).should.be.fulfilled

      await matchingMarketInstance.buy(1, toBN(first_offer_buy_amt * 0.5), { from: accounts[3] })

      const firstOrderInfo = await marketObserver.getOrder(1)
      expect((firstOrderInfo._type).toNumber()).to.be.eq(orderType.trade)
      expect(firstOrderInfo._data).to.be.eq(notifyData)

      await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - first_offer_pay_amt).toString()) // pay_amt collected upon making offer
      await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
      await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
      await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())
    })
  })
})
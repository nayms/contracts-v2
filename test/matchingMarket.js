import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils/index'
import {toBN, toWei, toHex } from './utils/web3'
import { events } from '..'

const IERC20 = artifacts.require("./base/IERC20")
const DummyToken = artifacts.require("./DummyToken")
const Market = artifacts.require('./MatchingMarket')


contract('MatchingMarket', accounts => {
    let matchingMarketInstance
    let expiry
    let oneHour

    let erc20WETH
    let erc20DAI
    let mintAmount

    before(async () => {
        erc20WETH = await DummyToken.new('Wrapped ETH', 'WETH', 18, 0, {from: accounts[0]})
        erc20DAI = await DummyToken.new('Dai Stablecoin', 'DAI', 18, 0, {from: accounts[0]})
        mintAmount = toWei('1000')

        for (let i = 1; i <= 4; i++) {
            await erc20WETH.mint(mintAmount, {from: accounts[i]})
            await erc20DAI.mint(mintAmount, {from: accounts[i]})
        }

        const now = ~~(Date.now() / 1000)
        oneHour = 3600
        expiry = now + oneHour

        matchingMarketInstance = await Market.new(expiry.toString(), {from: accounts[0]})
    })

    it('sets up default values', async () => {
        await matchingMarketInstance.close_time().should.eventually.eq(expiry.toString())
    })

    describe('last offer id', () => {
        it('get correct last offer id before creation of offers', async () => {
            await matchingMarketInstance.last_offer_id().should.eventually.eq(0)
        })
        
    })

    describe('offer', () => {
        it('make first offer', async () => {
            const pay_amt = toWei('10')
            const buy_amt = toWei('20')

            await erc20WETH.approve(
                matchingMarketInstance.address,
                pay_amt,
                {from: accounts[1]}
            ).should.be.fulfilled

            const offerTx = await matchingMarketInstance.offer(
                pay_amt,
                erc20WETH.address, 
                buy_amt,
                erc20DAI.address,
                0,
                true,
                {from: accounts[1]}
            )

            await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString())
        })

        it('get correct last offer id before creation of offers', async () => {
            await matchingMarketInstance.last_offer_id().should.eventually.eq(1)
        })

        it('make second offer', async () => {
            const pay_amt = toWei('10')
            const buy_amt = toWei('10')

            await erc20WETH.approve(
                matchingMarketInstance.address,
                pay_amt,
                {from: accounts[2]}
            ).should.be.fulfilled

            const offerTx = await matchingMarketInstance.offer(
                pay_amt,
                erc20WETH.address, 
                buy_amt,
                erc20DAI.address,
                0,
                true,
                {from: accounts[2]}
            )

            /* const eventArgs = extractEventArgs(offerTx, events.LogUnsortedOffer)
            expect(eventArgs).to.include({ id: '2' }) */
            
            await erc20WETH.balanceOf(accounts[2]).should.eventually.eq((mintAmount - pay_amt).toString())
        })
    })

    describe('getOwner', () => {
        it('should get correct offer owners', async () => {
            await matchingMarketInstance.getOwner(1).should.eventually.eq(accounts[1])
            await matchingMarketInstance.getOwner(2).should.eventually.eq(accounts[2])
        })
        
    })

    describe('getOffer', () => {
        it('should get correct offer details', async () => {
            await matchingMarketInstance.getOffer(1)  
            .should.eventually.matchObj({
                '0': toBN(10e18),
                '1': erc20WETH.address,
                '2': toBN(20e18),
                '3': erc20DAI.address
            })       
            
            await matchingMarketInstance.getOffer(2)
            .should.eventually.matchObj({
                '0': toBN(10e18),
                '1': erc20WETH.address,
                '2': toBN(10e18),
                '3': erc20DAI.address
            })
            
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
            await matchingMarketInstance.cancel(2, {from: accounts[1]}).should.be.rejectedWith('Offer can not be cancelled because user is not owner, and market is open, and offer sells required amount of tokens')
        })

        it('should allow offer owner to cancel offer successfully', async () => {
            await matchingMarketInstance.cancel(2, {from: accounts[2]}).should.be.fulfilled
        })

        it('cancelled order should be in an inactive state', async () => {
            const secondOfferActive = await matchingMarketInstance.isActive(2) 
            expect(secondOfferActive).to.be.equal(false)  
        })

        it('should delete cancelled offer successfully', async () => {
            await matchingMarketInstance.getOffer(2)
            .should.eventually.matchObj({
                '0': toBN(0),
                '1': ADDRESS_ZERO,
                '2': toBN(0),
                '3': ADDRESS_ZERO
            })
        })
    })

    describe('buy', () => {
        it('should fail to buy if offer is cancelled', async () => {
            const secondOfferActive = await matchingMarketInstance.isActive(2)
            expect(secondOfferActive).to.be.equal(false)  
            await matchingMarketInstance.buy(2, toWei('20'), {from: accounts[3]}).should.be.rejectedWith('revert')
        })

        it('should fail to buy successfully if amount is zero', async () => {
            const firstOfferActive = await matchingMarketInstance.isActive(1) 
            expect(firstOfferActive).to.be.equal(true)
            
            await erc20DAI.approve(
                matchingMarketInstance.address,
                toWei('20'),
                {from: accounts[3]}
            ).should.be.fulfilled

            await matchingMarketInstance.buy(1, 0, {from: accounts[3]}).should.be.rejectedWith('revert')
        })

        it('should fail to buy successfully if amount is not approved by buyer', async () => {
            const firstOfferActive = await matchingMarketInstance.isActive(1) 
            expect(firstOfferActive).to.be.equal(true)

            await erc20DAI.approve(
                matchingMarketInstance.address,
                0,
                {from: accounts[3]}
            ).should.be.fulfilled

            await matchingMarketInstance.buy(1, toWei('1'), {from: accounts[3]}).should.be.rejectedWith('revert')
        })

        it('should buy 50% or part of first offer successfully with 1:2 price ratio', async () => {
            const firstOfferActive = await matchingMarketInstance.isActive(1) 
            expect(firstOfferActive).to.be.equal(true)

            const pay_amt = toWei('10')
            const buy_amt = toWei('20')

            await erc20DAI.approve(
                matchingMarketInstance.address,
                toWei('10'), 
                {from: accounts[3]}
            ).should.be.fulfilled
            
            await matchingMarketInstance.buy(1, toBN(pay_amt * 0.5), {from: accounts[3]})

            await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString()) // pay_amt collected upon making offer
            await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1010').toString())
            await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1005').toString())
            await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('990').toString())
        })

        it('should use take function to buy second 50% or part of first offer successfully with 1:2 price ratio', async () => {
            const firstOfferActive = await matchingMarketInstance.isActive(1)
            expect(firstOfferActive).to.be.equal(true)

            const pay_amt = toWei('10')
            const buy_amt = toWei('20')

            await erc20DAI.approve(
                matchingMarketInstance.address,
                toWei('10'),
                {from: accounts[3]}
            ).should.be.fulfilled

            await matchingMarketInstance.buy(1, toBN(pay_amt * 0.5), {from: accounts[3]})

            await erc20WETH.balanceOf(accounts[1]).should.eventually.eq(toWei('990').toString())
            await erc20DAI.balanceOf(accounts[1]).should.eventually.eq(toWei('1020').toString())
            await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1010').toString())
            await erc20DAI.balanceOf(accounts[3]).should.eventually.eq(toWei('980').toString())
        
        })

        it('should set offer status to inactive if pay amount is all bought', async () => {
            const firstOfferActive = await matchingMarketInstance.isActive(1) 
            expect(firstOfferActive).to.be.equal(false)
        })

        it('should delete fully bought offer successfully', async () => {
            await matchingMarketInstance.getOffer(1)
            .should.eventually.matchObj({
                '0': toBN(0),
                '1': ADDRESS_ZERO,
                '2': toBN(0),
                '3': ADDRESS_ZERO
            })
        })
    })

    describe('offer', () => {
        it('should make offer', async () => {
            const pay_amt = toWei('20')
            const buy_amt = toWei('10')

            await erc20DAI.approve(
                matchingMarketInstance.address,
                pay_amt,
                {from: accounts[3]}
            ).should.be.fulfilled

            const second_offerTx = await matchingMarketInstance.offer(
                pay_amt,
                erc20DAI.address, 
                buy_amt,
                erc20WETH.address,
                0,
                true,
                {from: accounts[3]}
            )

            await erc20WETH.balanceOf(accounts[3]).should.eventually.eq(toWei('1010').toString())

            await matchingMarketInstance.getOffer(3)
            .should.eventually.matchObj({
                '0': toBN(20e18),
                '1': erc20DAI.address,
                '2': toBN(10e18),
                '3': erc20WETH.address
            })
        })
        
    })

    describe('sellAllAmount', () => {
        it('should revert if minimum fill amount cannot be sold', async () => {
            // buyer must have approved WETH to get minimum fill amount of DAI at best offer
            await erc20WETH.approve(
                matchingMarketInstance.address,
                toBN(5e18),
                {from: accounts[1]}
            ).should.be.fulfilled

            await matchingMarketInstance.getOffer(3)
            .should.eventually.matchObj({
                '0': toBN(20e18),
                '1': erc20DAI.address,
                '2': toBN(10e18),
                '3': erc20WETH.address
            })

            await matchingMarketInstance.sellAllAmount(erc20WETH.address, toBN(15e18), erc20DAI.address, toBN(30e18), {from: accounts[1]}).should.be.rejectedWith('revert')
        
        })

        it('should match offers, return the fill amount for a token pair, with pay amount and minimum fill amount', async () => {
            // buyer must have approved WETH to get DAI at best offer
            await erc20WETH.approve(
                matchingMarketInstance.address,
                toBN(5e18),
                {from: accounts[1]}
            ).should.be.fulfilled

            await matchingMarketInstance.getOffer(3)
            .should.eventually.matchObj({
                '0': toBN(20e18),
                '1': erc20DAI.address,
                '2': toBN(10e18),
                '3': erc20WETH.address
            })

            // matching offer 3
            // caller must approve amount to give
            // calls take which calls buy
            // Transfers funds from caller to offer maker, and from market to caller.
            console.log('sell all amount for offer 3 with min fill: ', (await matchingMarketInstance.sellAllAmount(erc20WETH.address, toBN(5e18), erc20DAI.address, toBN(10e18), {from: accounts[1]})).toString()) 
        
        })

        it('after match offer and selling, update offer amounts', async () => {
            await matchingMarketInstance.getOffer(3)
            .should.eventually.matchObj({
                '0': toBN(10e18), // previously toBN(20e18),
                '1': erc20DAI.address,
                '2': toBN(5e18), // previously toBN(10e18),
                '3': erc20WETH.address
            })
        })
    })

    
    describe('last offer id', () => {
        it('get correct last offer id after complete and active offers', async () => {
            await matchingMarketInstance.last_offer_id().should.eventually.eq(3)
        })
        
    })

    describe('matching offers', () => {
        it('use offer function to make offer successfully as an option instead of make', async () => {
            const pay_amt = toWei('10')
            const buy_amt = toWei('20')

            await erc20WETH.approve(
                matchingMarketInstance.address,
                pay_amt,
                {from: accounts[4]}
            ).should.be.fulfilled
            
            const txToMatch = await matchingMarketInstance.offer(
                pay_amt,
                erc20WETH.address, 
                buy_amt,
                erc20DAI.address,
                0,
                true,
                {from: accounts[4]}
            )

            // console.log(txToMatch)
            // events: LogSortedOffer, LogMake, LogItemUpdate
            // LogTrade, LogTake, LogItemUpdate

            await matchingMarketInstance.getOffer(3)
            .should.eventually.matchObj({
                '0': 0, // previously toBN(10e18) DAI,
                '1': ADDRESS_ZERO,
                '2': 0, // previously toBN(5e18) WETH,
                '3': ADDRESS_ZERO
            })

            await matchingMarketInstance.getOffer(4)
            .should.eventually.matchObj({
                '0': toBN(5e18), // previously toBN(20e18),
                '1': erc20WETH.address,
                '2': toBN(10e18), // previously toBN(10e18),
                '3': erc20DAI.address
            })
        })
        
    })

})




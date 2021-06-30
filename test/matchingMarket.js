import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils/index'
import {toBN, toWei } from './utils/web3'
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

        for (let i = 1; i <= 3; i++) {
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

    describe('synchronized', () => {

    })

    describe('make', () => {
        it('make first offer', async () => {
            const pay_amt = toWei('10')
            const buy_amt = toWei('20')

            await erc20WETH.approve(
                matchingMarketInstance.address,
                pay_amt,
                {from: accounts[1]}
            ).should.be.fulfilled

            const offerTx = await matchingMarketInstance.make(
                erc20WETH.address, 
                erc20DAI.address,
                pay_amt,
                buy_amt,
                {from: accounts[1]}
            )

            /* const eventArgs = extractEventArgs(offerTx, events.LogUnsortedOffer)
            expect(eventArgs).to.include({ id: '1' }) */

            await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString())
        })

        it('make second offer', async () => {
            const pay_amt = toWei('10')
            const buy_amt = toWei('10')

            await erc20WETH.approve(
                matchingMarketInstance.address,
                pay_amt,
                {from: accounts[2]}
            ).should.be.fulfilled

            const offerTx = await matchingMarketInstance.make(
                erc20WETH.address, 
                erc20DAI.address,
                pay_amt,
                buy_amt,
                {from: accounts[2]}
            )

            /* const eventArgs = extractEventArgs(offerTx, events.LogUnsortedOffer)
            expect(eventArgs).to.include({ id: '2' }) */
            
            await erc20WETH.balanceOf(accounts[1]).should.eventually.eq((mintAmount - pay_amt).toString())
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
            const secondOfferActive = await matchingMarketInstance.isActive(1)   
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

        it('should buy second 50% or part of first offer successfully with 1:2 price ratio', async () => {
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
    })

    describe('match offers', () => {
        xit('should add and match opposite offer for same token pair')
    })

    describe('insert', () => {

    })

    describe('del_rank', () => {

    })

    describe('setMinSell', () => {
        xit('should allow only admins to set the minimum sell amount for any token')

        xit('should revert if buy amount is below minimum sell')
    })

    describe('getMinSell', () => {
        xit('should get correct minimum sell amount for an offer or token when it is set')

        xit('should get correct minimum sell amount for an offer or token when not set')
    })

    describe('setBuyEnabled', () => {
        xit('should allow only admins to enable or disable buy')

        xit('should fail buy if buy disabled')

    })

    describe('setMatchingEnabled', () => {
        xit('allow only admin to enable matching')

        xit('allow only admin to disable matching')
    })

    describe('getBestOffer', () => {
        xit('should get best offer for a token pair')
    })

    describe('getWorseOffer', () => {
        xit('should return the worse offer in the sorted list of offers')
    })

    describe('getBetterOffer', () => {
        xit('should get the next better offer in the sorted list')
    })

    describe('getOfferCount', () => {
        xit('should return the amount of better offers for a token pair')
    })

    describe('getFirstUnsortedOffer', () => {
        xit('should get the first unsorted offer that was inserted by a contract')
    })

    describe('getNextUnsortedOffer', () => {
        xit('should get the next unsorted offer')
        //Can be used to cycle through all the unsorted offers.
    })

    describe('isOfferSorted', () => {
        xit('should successfully check whether an offer is sorted')
    })

    describe('sellAllAmount', () => {
        xit('should return the sell all amount for a token pair and pay amount')
    })

    describe('buyAllAmount', () => {
        xit('should get the buy all amount for a token pair')
    })

    describe('getBuyAmount', () => {
        xit('should get the buy amount for a token pair')
    })

    describe('getPayAmount', () => {
        xit('should get the pay amount for a token pair')
    })

})




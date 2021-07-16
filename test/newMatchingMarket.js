import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils/index'
import { toBN, toWei, toHex } from './utils/web3'
import { events } from '..'

import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'

const IERC20 = artifacts.require("./base/IERC20")
const DummyToken = artifacts.require("./DummyToken")
const Market = artifacts.require('./Market')
const IMarket = artifacts.require('./base/IMarket')


contract('Market', accounts => {

    let settings
    //let market
    let acl
    let systemContext

    let matchingMarketInstance
    let erc20WETH
    let erc20DAI
    let mintAmount

    before(async () => {
        // acl
        acl = await ensureAclIsDeployed({ artifacts })
        systemContext = await acl.systemContext()

        // settings
        settings = await ensureSettingsIsDeployed({ artifacts, acl })

        // market
        // market = await ensureMarketIsDeployed({ artifacts, settings })

    })

    beforeEach(async () => {
        erc20WETH = await DummyToken.new('Wrapped ETH', 'WETH', 18, 0, { from: accounts[0] })
        erc20DAI = await DummyToken.new('Dai Stablecoin', 'DAI', 18, 0, { from: accounts[0] })
        mintAmount = toWei('1000')

        for (let i = 1; i <= 4; i++) {
            await erc20WETH.mint(mintAmount, { from: accounts[i] })
            await erc20DAI.mint(mintAmount, { from: accounts[i] })
        }

        matchingMarketInstance = await ensureMarketIsDeployed({ artifacts, settings })
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
                {from: accounts[2]}
            ).should.be.fulfilled

            const offerTx = await matchingMarketInstance.executeLimitOffer(
                erc20WETH.address, 
                pay_amt,
                erc20DAI.address,
                buy_amt,
                {from: accounts[2]}
            )

            await matchingMarketInstance.getLastOfferId().should.eventually.eq(1)
        })
    })

    describe('supports getOffer, getOwner, isActive and cancel', () => {
        let first_offer_pay_amt;
        let second_offer_pay_amt;
        let first_offer_buy_amt;
        let second_offer_buy_amt;
        let firstOfferTx;
        let secondOfferTx;

        
    })

})
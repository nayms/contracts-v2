import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils'
import { events } from '..'
import { latest, duration, increaseTo, increase, parseEther, toBN } from './helpers/utils'
import { findEventInTransaction } from './helpers/events';

const IERC20 = artifacts.require("./base/IERC20")
const DummyToken = artifacts.require("./DummyToken")
const Market = artifacts.require('./MatchingMarket')


contract('ExpiringMarket', accounts => {
    let expiringMarketInstance
    let expiry
    let oneHour

    beforeEach(async () => {
        const now = await latest()
        oneHour = await duration.hours(1)
        expiry = now.add(oneHour) 

        expiringMarketInstance = await Market.new(expiry.toString(), {from: accounts[0]})

    })

    it('sets up default values', async () => {
        await expiringMarketInstance.close_time().should.eventually.eq(expiry.toString())
    })

    describe('getTime', () => {
        it('getTime()', async () => {
            const now = await latest()
            await expiringMarketInstance.getTime().should.eventually.eq(now.toString())
        })
    })

    describe('stop', () => {
        it('should be closed after stop', async () => {
            await expiringMarketInstance.stop({from: accounts[0]}).should.be.fulfilled
            await expiringMarketInstance.isClosed().should.eventually.eq(true)
        })
    })

    describe('isClosed', () => {
        it('isClosed()', async () => {
            await expiringMarketInstance.isClosed().should.eventually.eq(false)
        })

        it('should be closed after expiry', async () => {
            await increaseTo(expiry)
            await increase()
            await expiringMarketInstance.isClosed().should.eventually.eq(true)
        })
    })

})
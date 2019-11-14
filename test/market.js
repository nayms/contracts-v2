import { toHex, toWei, sha3, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
} from './utils'
import { events } from '../'

import { ensureEtherTokenIsDeployed } from '../migrations/utils/etherToken'

const ACL = artifacts.require("./base/ACL")
const IProxyImpl = artifacts.require("./base/IProxyImpl")
const IFUCImpl = artifacts.require("./base/IFUCImpl")
const IERC20 = artifacts.require("./base/IERC20")
const FUC = artifacts.require("./FUC")
const FUCImpl = artifacts.require("./FUCImpl")
const Market = artifacts.require("./MatchingMarket")
const EtherToken = artifacts.require("./EtherToken")

contract('Market', accounts => {
  let acl
  let fucImpl
  let fucProxy
  let fuc
  let erc1820Registry
  let market
  let etherToken
  let assetMgrRole
  let tranchToken

  beforeEach(async () => {
    etherToken = await ensureEtherTokenIsDeployed({ artifacts, accounts, web3 })

    acl = await ACL.new()
    fucImpl = await FUCImpl.new(acl.address, "acme")
    fucProxy = await FUC.new(
      acl.address, "acme",
      fucImpl.address,
      "fuc1"
    )
    // now let's speak to FUC contract using FUCImpl ABI
    fuc = await IFUCImpl.at(fucProxy.address)

    assetMgrRole = await fucProxy.ROLE_ASSET_MANAGER()

    // get market address
    market = await Market.new('0xFFFFFFFFFFFFFFFF')

    // setup one tranch with 100 shares at 1 WEI per share
    const r = await fucProxy.ROLE_ASSET_MANAGER()
    acl.assignRole("acme", accounts[1], r)
    await fuc.createTranch(100, 2, etherToken.address, ADDRESS_ZERO, { from: accounts[1] })
    const ta = await fuc.getTranch(0)
    tranchToken = await IERC20.at(ta)
  })

  describe('tranches begin trading', async () => {
    it('but not by an unauthorized person', async () => {
      await fuc.beginTranchSale(0, market.address).should.be.rejectedWith('unauthorized')
    })

    it('but not if initial allocation is not to parent policy', async () => {
      await fuc.createTranch(100, 2, etherToken.address, accounts[3], { from: accounts[1] })
      await fuc.beginTranchSale(1, market.address, { from: accounts[1] }).should.be.rejectedWith('initial holder must be policy contract')
    })

    it('by an authorized person', async () => {
      await tranchToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(fuc.address).should.eventually.eq(100)

      const result = await fuc.beginTranchSale(0, market.address, { from: accounts[1] })

      expect(extractEventArgs(result, events.BeginTranchSale)).to.include({
        tranch: '0',
        amount: '100',
        price: '200',
        unit: etherToken.address,
      })

      await tranchToken.balanceOf(market.address).should.eventually.eq(100)
      await tranchToken.balanceOf(fuc.address).should.eventually.eq(0)
    })

    it('and can only do this once', async () => {
      await fuc.beginTranchSale(0, market.address, { from: accounts[1] }).should.be.fulfilled
      await fuc.beginTranchSale(0, market.address, { from: accounts[1] }).should.be.rejectedWith('sale already started')
    })
  })

  describe('once a tranch begins trading', () => {
    beforeEach(async () => {
      await fuc.beginTranchSale(0, market.address, { from: accounts[1] })
      await etherToken.deposit({ from: accounts[2], value: 25 })
    })

    it('another party can make an offer that does not match', async () => {
      // check initial balances
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
      await etherToken.balanceOf(fuc.address).should.eventually.eq(0)
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(fuc.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)

      // // make the offer on the market
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      await market.offer(10, etherToken.address, 5000, tranchToken.address, 0, true, { from: accounts[2] })

      // check balances again
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
      await etherToken.balanceOf(fuc.address).should.eventually.eq(0)
      await etherToken.balanceOf(market.address).should.eventually.eq(10)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(fuc.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)
    })

    it('another party can make an offer that does match', async () => {
      // check initial balances
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
      await etherToken.balanceOf(fuc.address).should.eventually.eq(0)
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(fuc.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)

      // make the offer on the market
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      await market.offer(10, etherToken.address, 5, tranchToken.address, 0, true, { from: accounts[2] })

      // check balances again
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
      await etherToken.balanceOf(fuc.address).should.eventually.eq(10)
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(5)
      await tranchToken.balanceOf(fuc.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(95)
    })
  })
})

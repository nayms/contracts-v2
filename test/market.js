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
const Market = artifacts.require("./SimpleMarket")

contract('Market', accounts => {
  let acl
  let fucImpl
  let fucProxy
  let fuc
  let erc1820Registry
  let market
  let etherTokenAddress
  let assetMgrRole

  before(async () => {
    etherTokenAddress = await ensureEtherTokenIsDeployed({ artifacts, accounts, web3 })
  })

  beforeEach(async () => {
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
    acl.assignRole("acme", accounts[1], r),
    await fuc.createTranch(100, 1, etherTokenAddress, { from: accounts[1] }).should.be.fulfilled
  })

  describe('tranches begin trading', async () => {
    it('but not by an unauthorized person', async () => {
      await fuc.beginTranchSale(0, market.address).should.be.rejectedWith('unauthorized')
    })

    it.only('by an authorized person', async () => {
      const result = await fuc.beginTranchSale(0, market.address, { from: accounts[1] })

      expect(extractEventArgs(result, events.BeginTranchSale)).to.include({
        tranch: '0',
        amount: '100',
        price: '100',
        unit: etherTokenAddress,
      })
    })

    it('and can only do this once', async () => {
      await fuc.beginTranchSale(0, market.address, { from: accounts[1] }).should.be.fulfilled
      await fuc.beginTranchSale(0, market.address, { from: accounts[1] }).should.be.rejectedWith('sale already started')
    })

    it('by creating a sell offer', async () => {
      await fuc.beginTranchSale(0, market.address, { from: accounts[1] }).should.be.fulfilled
    })
  })
})

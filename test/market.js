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
const MatchingMarket = artifacts.require("./MatchingMarket")

contract('Market', accounts => {
  let acl
  let fucImpl
  let fucProxy
  let fuc
  let erc1820Registry
  let market
  let etherTokenAddress

  before(asyn () => {
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
    // get market address
    market = await MatchingMarket.new('0xFFFFFFFFFFFFFFFF')

    // setup one tranch with 100 shares at 1 WEI per share
    acl.assignRole("acme", accounts[0], await fuc.ROLE_ASSET_MANAGER()),
    await fuc.createTranches([100], [1]).should.be.fulfilled
  })

  it('todo!', async () => {
    console.log('TODO!')
  })
})

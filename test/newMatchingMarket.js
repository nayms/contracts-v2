import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils/index'
import {toBN, toWei, toHex } from './utils/web3'
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
  let market
  let acl
  let systemContext

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // market
    market = await ensureMarketIsDeployed({ artifacts, settings })

  })

  describe('deployment checks', () => {
    it('should return deployed market address', async () => {
        console.log(market.address)
        console.log(await market.getOffer(0))
    })
  })   

})
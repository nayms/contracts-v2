const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS, ADDRESS_ZERO } = require('../../utils/constants')

export const ensureMarketIsDeployed = async (cfg) => {
  const { deployer, artifacts, log: baseLog, accounts, settings, entityDeployer, getTxParams = defaultGetTxParams, extraFacets = [] } = cfg
  const log = createLog(baseLog)

  let addresses

  const Market = artifacts.require('./Market')
  const IMarket = artifacts.require('./IMarket')
  const IDiamondUpgradeFacet = artifacts.require('./base/IDiamondUpgradeFacet')

  await log.task(`Deploy Market implementations`, async task => {
    const CommonUpgradeFacet = artifacts.require('./CommonUpgradeFacet')
    const MarketCoreFacet = artifacts.require('./MarketCoreFacet')

    addresses = [
      await deploy(deployer, getTxParams(), CommonUpgradeFacet, settings.address),
      await deploy(deployer, getTxParams(), MarketCoreFacet, settings.address),
    ]

    for (let f of extraFacets) {
      addresses.push(await deploy(deployer, getTxParams(), f, settings.address))
    }

    addresses = addresses.map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving market implementation addresses to settings`, async task => {
    await settings.setAddresses(settings.address, SETTINGS.MARKET_IMPL, addresses, getTxParams())
  })

  let marketAddress
  let market

  await log.task('Retrieving existing market', async task => {
    marketAddress = await settings.getRootAddress(SETTINGS.MARKET)
    task.log(`Existing market: ${marketAddress}`)
  })

  if (marketAddress === ADDRESS_ZERO) {
    await log.task(`Deploy market`, async task => {
      market = await deploy(deployer, getTxParams(), Market, settings.address)
      task.log(`Deployed at ${market.address}`)
    })

    await log.task(`Saving market address ${market.address} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.MARKET, market.address, getTxParams())
    })
  } else {
    await log.task(`Upgrade market at ${marketAddress} with new facets`, async task => {
      market = await IDiamondUpgradeFacet.at(marketAddress)

      await execCall({
        task,
        contract: market,
        method: 'upgrade',
        args: [addresses],
        cfg,
      })
    })
  }

  cfg.market = await IMarket.at(market.address)

  return cfg.market
}

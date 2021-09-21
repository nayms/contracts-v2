const { createLog } = require('../utils/log')
const { deploy, execCall } = require('../utils')
const { SETTINGS, ADDRESS_ZERO } = require('../../utils/constants')

export const ensureMarketIsDeployed = async (ctx) => {
  const { log: baseLog, accounts, settings, entityDeployer, getTxParams, extraFacets = [] } = ctx
  const log = createLog(baseLog)

  let addresses

  const Market = await getContractFactory('./Market')
  const IMarket = await getContractFactory('./IMarket')
  const IDiamondUpgradeFacet = await getContractFactory('./base/IDiamondUpgradeFacet')

  await log.task(`Deploy Market implementations`, async task => {
    const CommonUpgradeFacet = await getContractFactory('./CommonUpgradeFacet')
    const MarketCoreFacet = await getContractFactory('./MarketCoreFacet')
    const MarketDataFacet = await getContractFactory('./MarketDataFacet')

    addresses = [
      await deploy(getTxParams(), CommonUpgradeFacet, settings.address),
      await deploy(getTxParams(), MarketCoreFacet, settings.address),
      await deploy(getTxParams(), MarketDataFacet, settings.address),
    ]

    for (let f of extraFacets) {
      addresses.push(await deploy(getTxParams(), f, settings.address))
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
      market = await deploy(getTxParams(), Market, settings.address)
      task.log(`Deployed at ${market.address}`)
    })

    await log.task(`Saving market address ${market.address} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.MARKET, market.address, getTxParams())
    })
  } else {
    await log.task(`Upgrade market at ${marketAddress} with new facets`, async task => {
      market = await IDiamondUpgradeFacet.attach(marketAddress)

      await execCall({
        task,
        contract: market,
        method: 'upgrade',
        args: [addresses],
        ctx,
      })
    })
  }

  return await IMarket.attach(market.address)
}

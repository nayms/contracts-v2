const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensureMarketIsDeployed = async ({ deployer, artifacts, logger }, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Market ...')

  // deploy market
  const Market = artifacts.require('./MatchingMarket')
  const market = await deploy(deployer, Market, '0xFFFFFFFFFFFFFFFF')

  log(`... deployed at ${market.address}`)

  log('Saving market address to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettings')
  const settings = await Settings.at(settingsAddress)
  await settings.setAddress(settings.address, SETTINGS.MARKET, market.address)

  log('... saved')

  return market
}

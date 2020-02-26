const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')

export const ensureMarketIsDeployed = async ({ deployer, artifacts, logger }, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Market ...')

  // deploy market
  const Market = artifacts.require('./MatchingMarket')
  const market = await Market.new('0xFFFFFFFFFFFFFFFF')

  log(`... deployed at ${market.address}`)

  log('Saving market address to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettingsImpl')
  const settings = await Settings.at(settingsAddress)
  await settings.setMatchingMarket(market.address)

  log('... saved')

  return market
}

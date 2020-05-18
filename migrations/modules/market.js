const { createLog } = require('../../utils/log')
const { deploy, getCurrentInstance } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentMarket = async ({ artifacts, networkId, log }) => {
  return getCurrentInstance({ networkId, log, artifacts, type: 'IMarket', lookupType: 'MatchingMarket' })
}

export const ensureMarketIsDeployed = async ({ deployer, artifacts, log }, settingsAddress) => {
  log = createLog(log)

  let market

  await log.task(`Deploy Market`, async task => {
    const Market = artifacts.require('./MatchingMarket')
    market = await deploy(deployer, Market, '0xFFFFFFFFFFFFFFFF')
    task.log(`Deployed at ${market.address}`)
  })

  await log.task(`Saving Market address to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)
    await settings.setAddress(settings.address, SETTINGS.MARKET, market.address)
  })

  return market
}

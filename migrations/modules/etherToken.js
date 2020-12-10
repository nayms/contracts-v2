const { createLog } = require('../utils/log')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentEtherToken = async ({ artifacts, networkInfo, log }) => {
  return getCurrentInstance({ networkInfo, log, artifacts, type: 'IEtherToken', lookupType: 'EtherToken' })
}

export const ensureEtherTokenIsDeployed = async ({ deployer, artifacts, log, getTxParams = defaultGetTxParams }, settingsAddress) => {
  log = createLog(log)

  let etherToken

  await log.task(`Deploy EtherToken`, async task => {
    const EtherToken = artifacts.require('./EtherToken')
    etherToken = await deploy(deployer, getTxParams(), EtherToken, settingsAddress)
    task.log(`Deployed at ${etherToken.address}`)
  })

  await log.task(`Saving EtherToken address to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)
    await settings.setAddress(settings.address, SETTINGS.ETHER_TOKEN, etherToken.address, getTxParams())
  })

  return etherToken
}

export const deployNewEtherToken = async ({ artifacts }, settingsAddress) => {
  const EtherToken = artifacts.require('./EtherToken')
  return await EtherToken.new(settingsAddress)
}

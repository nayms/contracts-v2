const { createLog } = require('../../utils/log')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentEtherToken = async ({ artifacts, networkId, log }) => {
  return getCurrentInstance({ networkId, log, artifacts, type: 'IEtherToken', lookupType: 'EtherToken' })
}

export const ensureEtherTokenIsDeployed = async ({ deployer, artifacts, log, getTxParams = defaultGetTxParams }, aclAddress, settingsAddress) => {
  log = createLog(log)

  let etherToken

  await log.task(`Deploy EtherToken`, async task => {
    const EtherToken = artifacts.require('./EtherToken')
    etherToken = await deploy(deployer, getTxParams(), EtherToken, aclAddress, settingsAddress)
    task.log(`Deployed at ${etherToken.address}`)
  })

  await log.task(`Saving EtherToken address to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)
    await settings.setAddress(settings.address, SETTINGS.ETHER_TOKEN, etherToken.address, getTxParams())
  })

  return etherToken
}

export const deployNewEtherToken = async ({ artifacts }, aclAddress, settingsAddress) => {
  const EtherToken = artifacts.require('./EtherToken')
  return await EtherToken.new(aclAddress, settingsAddress)
}

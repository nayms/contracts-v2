const { createLog } = require('../utils/log')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentEtherToken = async ({ artifacts, networkInfo, log }) => {
  return getCurrentInstance({ networkInfo, log, artifacts, type: 'IEtherToken', lookupType: 'EtherToken' })
}

export const ensureEtherTokenIsDeployed = async ({ deployer, artifacts, log, settings, getTxParams = defaultGetTxParams }) => {
  log = createLog(log)

  let etherToken

  await log.task(`Deploy EtherToken`, async task => {
    const EtherToken = artifacts.require('./EtherToken')
    etherToken = await deploy(deployer, getTxParams(), EtherToken, settings.address)
    task.log(`Deployed at ${etherToken.address}`)
  })

  await log.task(`Saving EtherToken address to settings`, async () => {
    await settings.setAddress(settings.address, SETTINGS.ETHER_TOKEN, etherToken.address, getTxParams())
  })

  return etherToken
}

export const deployNewEtherToken = async ({ artifacts, settings }) => {
  const EtherToken = artifacts.require('./EtherToken')
  return await EtherToken.new(settings.address)
}

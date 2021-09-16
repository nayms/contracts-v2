const { createLog } = require('../utils/log')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../utils')

export const getCurrentSettings = async ({ artifacts, networkInfo, log }) => {
  return getCurrentInstance({ networkInfo, log, artifacts, type: 'ISettings', lookupType: 'Settings' })
}

export const ensureSettingsIsDeployed = async ({ deployer, artifacts, log, acl, getTxParams = defaultGetTxParams }) => {
  log = createLog(log)

  let settings

  await log.task(`Deploy Settings`, async task => {
    const Settings = artifacts.require('./Settings')
    settings = await deploy(deployer, getTxParams(), Settings, acl.address)
    task.log(`Deployed at ${settings.address}`)
  })

  const ISettings = artifacts.require('./ISettings')

  return await ISettings.at(settings.address)
}

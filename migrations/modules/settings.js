const { createLog } = require('../../utils/log')
const { deploy, getCurrentInstance } = require('../../utils/functions')

export const getCurrentSettings = async ({ artifacts, networkId, log }) => {
  return getCurrentInstance({ networkId, log, artifacts, type: 'ISettings', lookupType: 'Settings' })
}

export const ensureSettingsIsDeployed = async ({ deployer, artifacts, log }, aclAddress) => {
  log = createLog(log)

  let settings

  await log.task(`Deploy Settings`, async task => {
    const Settings = artifacts.require('./Settings')
    settings = await deploy(deployer, Settings, aclAddress)
    task.log(`Deployed at ${settings.address}`)
  })

  const ISettings = artifacts.require('./ISettings')

  return await ISettings.at(settings.address)
}

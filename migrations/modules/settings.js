const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')

export const ensureSettingsIsDeployed = async ({ deployer, artifacts, logger }, aclAddress) => {
  const log = createLog(logger)

  log('Deploying Settings ...')
  const Settings = artifacts.require('./Settings')
  const settings = await deploy(deployer, Settings, aclAddress)
  log(`... deployed at ${settings.address}`)

  const ISettings = artifacts.require('./ISettings')

  return await ISettings.at(settings.address)
}

const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')

export const deploySettings = async ({ deployer, artifacts, logger }, aclAddress) => {
  const log = createLog(logger)

  log('Deploying SettingsImpl ...')
  const SettingsImpl = artifacts.require('./SettingsImpl')
  const settingsImpl = await deploy(deployer, SettingsImpl, aclAddress)
  log(`... deployed at ${settingsImpl.address}`)

  log('Deploying Settings ...')
  const Settings = artifacts.require('./Settings')
  const settings = await deploy(deployer, Settings, aclAddress, settingsImpl.address)
  log(`... deployed at ${settings.address}`)

  return await SettingsImpl.at(settings.address)
}

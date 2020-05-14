const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensureEntityImplementationIsDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Entity implementation ...')

  const EntityImpl = artifacts.require('./EntityImpl')

  const entityImpl = await deploy(deployer, EntityImpl, aclAddress, settingsAddress)

  log(`... deployed at ${entityImpl.address}`)

  log('Saving entity implementation address to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettings')
  const settings = await Settings.at(settingsAddress)
  await settings.setAddress(settings.address, SETTINGS.ENTITY_IMPL, entityImpl.address)

  log('... saved')

  return entityImpl
}

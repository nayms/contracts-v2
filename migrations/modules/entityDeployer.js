const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensureEntityDeployerIsDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying EntityDeployer ...')

  // deploy
  const EntityDeployer = artifacts.require('./EntityDeployer')
  const entityDeployer = await deploy(deployer, EntityDeployer, aclAddress, settingsAddress)

  log(`... deployed at ${entityDeployer.address}`)

  log('Deploying Nayms entity ...')

  const numEntities = await entityDeployer.getNumEntities()
  if (0 == numEntities) {
    await entityDeployer.deploy()
  }

  const naymsEntityAddress = await entityDeployer.getEntity(0)

  log(`... deployed at ${naymsEntityAddress}`)

  log('Saving entity deployer and nayms entity addresses to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettings')
  const settings = await Settings.at(settingsAddress)
  await settings.setAddress(settings.address, SETTINGS.ENTITY_DEPLOYER, entityDeployer.address)
  await settings.setAddress(settings.address, SETTINGS.NAYMS_ENTITY, naymsEntityAddress)

  log('... saved')

  return entityDeployer
}
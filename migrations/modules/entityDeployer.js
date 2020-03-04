const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')

export const ensureEntityDeployerIsDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress, entityImplAddress) => {
  const log = createLog(logger)

  log('Deploying EntityDeployer ...')

  // deploy
  const EntityDeployer = artifacts.require('./EntityDeployer')
  const entityDeployer = await deploy(deployer, EntityDeployer, aclAddress, settingsAddress, entityImplAddress)

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
  const Settings = artifacts.require('./ISettingsImpl')
  const settings = await Settings.at(settingsAddress)
  await settings.setEntityDeployer(entityDeployer.address)
  await settings.setNaymsEntity(naymsEntityAddress)

  log('... saved')

  return entityDeployer
}

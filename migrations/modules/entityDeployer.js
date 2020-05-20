const { createLog } = require('../../utils/log')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentEntityDeployer = async ({ artifacts, networkId, log }) => {
  return getCurrentInstance({ networkId, log, artifacts, type: 'IEntityDeployer', lookupType: 'EntityDeployer' })
}

export const ensureEntityDeployerIsDeployed = async ({ deployer, artifacts, log, getTxParams = defaultGetTxParams }, aclAddress, settingsAddress) => {
  log = createLog(log)

  let entityDeployer

  await log.task(`Deploy EntityDeployer`, async task => {
    const EntityDeployer = artifacts.require('./EntityDeployer')
    entityDeployer = await deploy(deployer, getTxParams(), EntityDeployer, aclAddress, settingsAddress)
    task.log(`Deployed at ${entityDeployer.address}`)
  })

  let naymsEntityAddress

  await log.task(`Deploy Nayms entity`, async task => {
    const numEntities = await entityDeployer.getNumEntities()
    if (0 == numEntities) {
      await entityDeployer.deploy(getTxParams())
    }

    naymsEntityAddress = await entityDeployer.getEntity(0)

    task.log(`Deployed at ${naymsEntityAddress}`)
  })

  await log.task(`Saving entity deployer and nayms entity addresses to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)
    await Promise.all([
      settings.setAddress(settings.address, SETTINGS.ENTITY_DEPLOYER, entityDeployer.address, getTxParams()),
      settings.setAddress(settings.address, SETTINGS.NAYMS_ENTITY, naymsEntityAddress, getTxParams()),
    ])
  })

  return entityDeployer
}
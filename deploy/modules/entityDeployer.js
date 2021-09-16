const { createLog } = require('../utils/log')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentEntityDeployer = async ({ artifacts, networkInfo, log }) => {
  return getCurrentInstance({ networkInfo, log, artifacts, type: 'IEntityDeployer', lookupType: 'EntityDeployer' })
}

export const ensureEntityDeployerIsDeployed = async ({ deployer, artifacts, log, settings, getTxParams = defaultGetTxParams }) => {
  log = createLog(log)

  let entityDeployer

  await log.task(`Deploy EntityDeployer`, async task => {
    const EntityDeployer = artifacts.require('./EntityDeployer')
    entityDeployer = await deploy(deployer, getTxParams(), EntityDeployer, settings.address)
    task.log(`Deployed at ${entityDeployer.address}`)
  })


  await log.task(`Saving entity deployer address to settings`, async () => {
    await settings.setAddress(settings.address, SETTINGS.ENTITY_DEPLOYER, entityDeployer.address, getTxParams())
  })

  return entityDeployer
}
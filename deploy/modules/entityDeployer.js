const { createLog } = require('../utils/log')
const { getCurrentInstance, deployContract, getContractAt } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentEntityDeployer = async ({ networkInfo, log }) => {
  return getCurrentInstance({ networkInfo, log, type: 'IEntityDeployer', lookupType: 'EntityDeployer' })
}

export const ensureEntityDeployerIsDeployed = async (ctx) => {
  const { settings, getTxParams } = ctx

  const log = createLog(ctx.log)

  let entityDeployer

  await log.task(`Deploy EntityDeployer`, async task => {
    entityDeployer = await deployContract(ctx, 'EntityDeployer', settings.address)
    task.log(`Deployed at ${entityDeployer.address}`)
  })


  await log.task(`Saving entity deployer address to settings`, async () => {
    await settings.setAddress(settings.address, SETTINGS.ENTITY_DEPLOYER, entityDeployer.address, getTxParams())
  })

  return await getContractAt('IEntityDeployer', entityDeployer.address)
}
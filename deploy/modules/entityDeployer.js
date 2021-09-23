const { createLog } = require('../utils/log')
const { getDeployedContractInstance, deployContract, getContractAt, execMethod } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const getCurrentEntityDeployer = async ({ network, log }) => {
  return getDeployedContractInstance({ network, log, type: 'IEntityDeployer', lookupType: 'EntityDeployer' })
}

export const ensureEntityDeployerIsDeployed = async (ctx = {}) => {
  const { settings } = ctx

  const log = createLog(ctx.log)

  let entityDeployer

  await log.task(`Deploy EntityDeployer`, async task => {
    entityDeployer = await deployContract(ctx, 'EntityDeployer', [settings.address], { gasLimit: 7000000 })
    task.log(`Deployed at ${entityDeployer.address}`)
  })


  await log.task(`Saving entity deployer address to settings`, async task => {
    await execMethod({ ctx, task, contract: settings }, 'setAddress', settings.address, SETTINGS.ENTITY_DEPLOYER, entityDeployer.address)
  })

  return await getContractAt('IEntityDeployer', entityDeployer.address)
}
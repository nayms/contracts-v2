import { createLog } from '../utils/log'
import { getDeployedContractInstance, deployContract, getContractAt } from '../utils'

export const getCurrentSettings = async ({ network, log }) => {
  return getDeployedContractInstance({ network, log, type: 'ISettings', lookupType: 'Settings' })
}

export const ensureSettingsIsDeployed = async (ctx = {}) => {
  const { acl } = ctx

  const log = createLog(ctx.log)

  let settings

  await log.task(`Deploy Settings`, async task => {
    settings = await deployContract(ctx, 'Settings', [acl.address])
    task.log(`Deployed at ${settings.address}`)
  })

  return await getContractAt('ISettings', settings.address)
}

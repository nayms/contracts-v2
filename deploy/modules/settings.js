const { createLog } = require('../utils/log')
const { getCurrentInstance, deployContract, getContractAt } = require('../utils')

export const getCurrentSettings = async ({ networkInfo, log }) => {
  return getCurrentInstance({ networkInfo, log, type: 'ISettings', lookupType: 'Settings' })
}

export const ensureSettingsIsDeployed = async (ctx) => {
  const { acl } = ctx

  const log = createLog(ctx.log)

  let settings

  await log.task(`Deploy Settings`, async task => {
    settings = await deployContract(ctx, 'Settings', acl.address)
    task.log(`Deployed at ${settings.address}`)
  })

  return await getContractAt('ISettings', settings.address)
}

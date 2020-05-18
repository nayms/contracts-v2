const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensureEntityImplementationsAreDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Entity implementations ...')

  const EntityCoreFacet = artifacts.require('./EntityCoreFacet')

  const ret = (await Promise.all([
    deploy(deployer, EntityCoreFacet, aclAddress, settingsAddress)
  ])).map(c => c.address)

  log(`... deployed at ${ret.join(', ')}`)

  log('Saving entity implementation addresses to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettings')
  const settings = await Settings.at(settingsAddress)
  await settings.setAddresses(settings.address, SETTINGS.ENTITY_IMPL, ret)

  log('... saved')

  return ret
}

const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const ensureEntityImplementationsAreDeployed = async (cfg, settingsAddress) => {
  const { deployer, artifacts, log: baseLog, getTxParams = defaultGetTxParams } = cfg
  const log = createLog(baseLog)

  let addresses

  await log.task(`Deploy Entity implementations`, async task => {
    const EntityUpgradeFacet = artifacts.require('./EntityUpgradeFacet')
    const EntityCoreFacet = artifacts.require('./EntityCoreFacet')

    addresses = [
      await deploy(deployer, getTxParams(), EntityCoreFacet, settingsAddress),
      await deploy(deployer, getTxParams(), EntityUpgradeFacet, settingsAddress),
    ].map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })


  await log.task(`Saving entity implementation addresses to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)

    await execCall({
      task,
      contract: settings,
      method: 'setAddresses',
      args: [settings.address, SETTINGS.ENTITY_IMPL, addresses],
      cfg,
    })
  })

  return addresses
}

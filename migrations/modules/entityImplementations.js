const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const ensureEntityImplementationsAreDeployed = async ({ deployer, artifacts, log, getTxParams = defaultGetTxParams, onlyDeployingUpgrades }, aclAddress, settingsAddress) => {
  log = createLog(log)

  let addresses

  await log.task(`Deploy Entity implementations`, async task => {
    const EntityUpgradeFacet = artifacts.require('./EntityUpgradeFacet')
    const EntityCoreFacet = artifacts.require('./EntityCoreFacet')
    const EntityTokenMinterFacet = artifacts.require('./EntityTokenMinterFacet')
    const EntityTokenImplFacet = artifacts.require('./EntityTokenImplFacet')

    addresses = [
      await deploy(deployer, getTxParams(), EntityCoreFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), EntityUpgradeFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), EntityTokenMinterFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), EntityTokenImplFacet, aclAddress, settingsAddress),
    ].map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })


  await log.task(`Saving entity implementation addresses to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)
    await settings.setAddresses(settings.address, SETTINGS.ENTITY_IMPL, addresses, getTxParams())
  })

  return addresses
}

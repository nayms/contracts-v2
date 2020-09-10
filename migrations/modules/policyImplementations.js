const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async ({ deployer, artifacts, log, getTxParams = defaultGetTxParams }, aclAddress, settingsAddress) => {
  log = createLog(log)

  let addresses

  await log.task(`Deploy Policy implementations`, async task => {
    const PolicyUpgradeFacet = artifacts.require('./PolicyUpgradeFacet')
    const PolicyInitializerFacet = artifacts.require('./PolicyInitializerFacet')
    const PolicyCoreFacet = artifacts.require('./PolicyCoreFacet')
    const PolicyClaimsFacet = artifacts.require('./PolicyClaimsFacet')
    const PolicyCommissionsFacet = artifacts.require('./PolicyCommissionsFacet')
    const PolicyPremiumsFacet = artifacts.require('./PolicyPremiumsFacet')
    const PolicyTranchTokensFacet = artifacts.require('./PolicyTranchTokensFacet')

    addresses = [
      await deploy(deployer, getTxParams(), PolicyCoreFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyUpgradeFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyInitializerFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyClaimsFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyCommissionsFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyPremiumsFacet, aclAddress, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyTranchTokensFacet, aclAddress, settingsAddress),
    ].map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving policy implementation addresses to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)
    await settings.setAddresses(settings.address, SETTINGS.POLICY_IMPL, addresses, getTxParams())
  })

  return addresses
}


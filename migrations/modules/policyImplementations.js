const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async ({ deployer, artifacts, log }, aclAddress, settingsAddress) => {
  log = createLog(log)

  let addresses

  await log.task(`Deploy Policy implementations`, async task => {
    const PolicyUpgradeFacet = artifacts.require('./PolicyUpgradeFacet')
    const PolicyCoreFacet = artifacts.require('./PolicyCoreFacet')
    const PolicyClaimsFacet = artifacts.require('./PolicyClaimsFacet')
    const PolicyCommissionsFacet = artifacts.require('./PolicyCommissionsFacet')
    const PolicyPremiumsFacet = artifacts.require('./PolicyPremiumsFacet')
    const PolicyTranchTokensFacet = artifacts.require('./PolicyTranchTokensFacet')

    addresses = (await Promise.all([
      deploy(deployer, PolicyCoreFacet, aclAddress, settingsAddress),
      deploy(deployer, PolicyUpgradeFacet, aclAddress, settingsAddress),
      deploy(deployer, PolicyClaimsFacet, aclAddress, settingsAddress),
      deploy(deployer, PolicyCommissionsFacet, aclAddress, settingsAddress),
      deploy(deployer, PolicyPremiumsFacet, aclAddress, settingsAddress),
      deploy(deployer, PolicyTranchTokensFacet, aclAddress, settingsAddress),
    ])).map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving policy implementation addresses to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)
    await settings.setAddresses(settings.address, SETTINGS.POLICY_IMPL, addresses)
  })

  return addresses
}


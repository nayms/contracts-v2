const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Policy implementations ...')

  const PolicyUpgradeFacet = artifacts.require('./PolicyUpgradeFacet')
  const PolicyCoreFacet = artifacts.require('./PolicyCoreFacet')
  const PolicyClaimsFacet = artifacts.require('./PolicyClaimsFacet')
  const PolicyCommissionsFacet = artifacts.require('./PolicyCommissionsFacet')
  const PolicyPremiumsFacet = artifacts.require('./PolicyPremiumsFacet')
  const PolicyTranchTokensFacet = artifacts.require('./PolicyTranchTokensFacet')

  const ret = (await Promise.all([
    deploy(deployer, PolicyCoreFacet, aclAddress, settingsAddress),
    deploy(deployer, PolicyUpgradeFacet, aclAddress, settingsAddress),
    deploy(deployer, PolicyClaimsFacet, aclAddress, settingsAddress),
    deploy(deployer, PolicyCommissionsFacet, aclAddress, settingsAddress),
    deploy(deployer, PolicyPremiumsFacet, aclAddress, settingsAddress),
    deploy(deployer, PolicyTranchTokensFacet, aclAddress, settingsAddress),
  ])).map(c => c.address)

  log(`... deployed at ${ret.join(', ')}`)

  log('Saving policy implementations addresses to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettings')
  const settings = await Settings.at(settingsAddress)
  await settings.setAddresses(settings.address, SETTINGS.POLICY_IMPL, ret)

  log('... saved')

  return ret
}


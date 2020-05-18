const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Policy implementations ...')

  const PolicyClaims = artifacts.require('./PolicyClaims')
  const PolicyCommissions = artifacts.require('./PolicyCommissions')
  const PolicyPremiums = artifacts.require('./PolicyPremiums')
  const PolicyCore = artifacts.require('./PolicyCore')
  const PolicyTranchTokens = artifacts.require('./PolicyTranchTokens')

  const ret = (await Promise.all([
    deploy(deployer, PolicyCore, aclAddress, settingsAddress),
    deploy(deployer, PolicyClaims, aclAddress, settingsAddress),
    deploy(deployer, PolicyCommissions, aclAddress, settingsAddress),
    deploy(deployer, PolicyPremiums, aclAddress, settingsAddress),
    deploy(deployer, PolicyTranchTokens, aclAddress, settingsAddress),
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


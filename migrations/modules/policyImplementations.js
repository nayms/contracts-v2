const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')
const { SETTINGS } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Policy implementations ...')

  const PolicyClaims = artifacts.require('./PolicyClaims')
  const PolicyCommissions = artifacts.require('./PolicyCommissions')
  const PolicyPremiums = artifacts.require('./PolicyPremiums')
  const PolicyImpl = artifacts.require('./PolicyImpl')

  const ret = {
    policyClaims: await deploy(deployer, PolicyClaims, aclAddress, settingsAddress),
    policyCommissions: await deploy(deployer, PolicyCommissions, aclAddress, settingsAddress),
    policyPremiums: await deploy(deployer, PolicyPremiums, aclAddress, settingsAddress),
    policyImpl: await deploy(deployer, PolicyImpl, aclAddress, settingsAddress),
  }

  log(`... deployed`)

  log('Saving policy implementations addresses to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettings')
  const settings = await Settings.at(settingsAddress)
  await settings.setAddress(settings.address, SETTINGS.POLICY_IMPL, ret.policyImpl.address)
  await settings.setAddress(settings.address, SETTINGS.POLICY_CLAIMS_IMPL, ret.policyClaims.address)
  await settings.setAddress(settings.address, SETTINGS.POLICY_COMMISSIONS_IMPL, ret.policyCommissions.address)
  await settings.setAddress(settings.address, SETTINGS.POLICY_PREMIUMS_IMPL, ret.policyPremiums.address)

  log('... saved')

  return ret
}


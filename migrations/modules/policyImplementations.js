const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')

export const ensurePolicyImplementationsAreDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying Policy implementations ...')

  const PolicyMutations = artifacts.require('./PolicyMutations')
  const PolicyImpl = artifacts.require('./PolicyImpl')

  const ret = {
    policyMutations: await deploy(deployer, PolicyMutations, aclAddress, settingsAddress),
    policyImpl: await deploy(deployer, PolicyImpl, aclAddress, settingsAddress),
  }

  log(`... deployed`)

  log('Saving policy implementations addresses to settings ...')

  // save to settings
  const Settings = artifacts.require('./ISettingsImpl')
  const settings = await Settings.at(settingsAddress)
  await settings.setPolicyImplementation(ret.policyImpl.address)
  await settings.setPolicyMutations(ret.policyMutations.address)

  log('... saved')

  return ret
}


const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async (cfg, settingsAddress) => {
  const { deployer, artifacts, log: baseLog, getTxParams = defaultGetTxParams } = cfg
  const log = createLog(baseLog)

  let addresses

  await log.task(`Deploy Policy implementations`, async task => {
    const PolicyUpgradeFacet = artifacts.require('./PolicyUpgradeFacet')
    const PolicyCoreFacet = artifacts.require('./PolicyCoreFacet')
    const PolicyClaimsFacet = artifacts.require('./PolicyClaimsFacet')
    const PolicyCommissionsFacet = artifacts.require('./PolicyCommissionsFacet')
    const PolicyPremiumsFacet = artifacts.require('./PolicyPremiumsFacet')
    const PolicyTranchTokensFacet = artifacts.require('./PolicyTranchTokensFacet')

    addresses = [
      await deploy(deployer, getTxParams(), PolicyCoreFacet, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyUpgradeFacet, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyClaimsFacet, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyCommissionsFacet, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyPremiumsFacet, settingsAddress),
      await deploy(deployer, getTxParams(), PolicyTranchTokensFacet, settingsAddress),
    ].map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving policy implementation addresses to settings`, async task => {
    const Settings = artifacts.require('./ISettings')
    const settings = await Settings.at(settingsAddress)

    await execCall({
      task,
      contract: settings,
      method: 'setAddresses',
      args: [settings.address, SETTINGS.POLICY_IMPL, addresses],
      cfg,
    })
  })

  return addresses
}


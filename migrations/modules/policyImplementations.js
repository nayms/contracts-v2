const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async (cfg) => {
  const { deployer, artifacts, log: baseLog, settings, getTxParams = defaultGetTxParams } = cfg
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
      await deploy(deployer, getTxParams(), PolicyCoreFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyUpgradeFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyClaimsFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyCommissionsFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyPremiumsFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyTranchTokensFacet, settings.address),
    ].map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving policy implementation addresses to settings`, async task => {
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


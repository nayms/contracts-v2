const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS, ADDRESS_ZERO } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async (cfg) => {
  const { deployer, artifacts, log: baseLog, settings, getTxParams = defaultGetTxParams, extraFacets = [] } = cfg
  const log = createLog(baseLog)

  let addresses

  await log.task(`Deploy Policy implementations`, async task => {
    const PolicyUpgradeFacet = artifacts.require('./PolicyUpgradeFacet')
    const PolicyCoreFacet = artifacts.require('./PolicyCoreFacet')
    const PolicyClaimsFacet = artifacts.require('./PolicyClaimsFacet')
    const PolicyCommissionsFacet = artifacts.require('./PolicyCommissionsFacet')
    const PolicyPremiumsFacet = artifacts.require('./PolicyPremiumsFacet')
    const PolicyTranchTokensFacet = artifacts.require('./PolicyTranchTokensFacet')
    const PolicyApprovalsFacet = artifacts.require('./PolicyApprovalsFacet')

    addresses = [
      await deploy(deployer, getTxParams(), PolicyCoreFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyUpgradeFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyClaimsFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyCommissionsFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyPremiumsFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyTranchTokensFacet, settings.address),
      await deploy(deployer, getTxParams(), PolicyApprovalsFacet, settings.address),
    ]
    
    for (let f of extraFacets) {
      addresses.push(await deploy(deployer, getTxParams(), f, settings.address))
    }

    addresses = addresses.map(c => c.address)

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

  let policyDelegateAddress

  await log.task('Retrieving existing policy delegate', async task => {
    policyDelegateAddress = await settings.getRootAddress(SETTINGS.POLICY_DELEGATE)
    task.log(`Existing policy delegate: ${policyDelegateAddress}`)
  })

  if (policyDelegateAddress === ADDRESS_ZERO) {
    const PolicyDelegate = artifacts.require('./PolicyDelegate')

    await log.task(`Deploy policy delegate`, async task => {
      const { address } = await deploy(deployer, getTxParams(), PolicyDelegate, settings.address)
      policyDelegateAddress = address
      task.log(`Deployed at ${policyDelegateAddress}`)
    })

    await log.task(`Saving policy delegate address ${policyDelegateAddress} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.POLICY_DELEGATE, policyDelegateAddress, getTxParams())
    })
  } else {
    await log.task(`Upgrade policy delegate at ${policyDelegateAddress} with new facets`, async () => {
      const entityDelegate = await PolicyDelegate.at(policyDelegateAddress)
      await entityDelegate.upgrade(addresses)
    })
  }

  return addresses
}


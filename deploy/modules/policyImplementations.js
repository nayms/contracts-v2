const { createLog } = require('../utils/log')
const { deploy, execCall } = require('../utils')
const { SETTINGS, ADDRESS_ZERO } = require('../../utils/constants')

export const ensurePolicyImplementationsAreDeployed = async (ctx) => {
  const { log: baseLog, settings, getTxParams, extraFacets = [] } = ctx
  const log = createLog(baseLog)

  let addresses

  const PolicyDelegate = await getContractFactory('./PolicyDelegate')
  const IDiamondUpgradeFacet = await getContractFactory('./base/IDiamondUpgradeFacet')

  await log.task(`Deploy Policy implementations`, async task => {
    const CommonUpgradeFacet = await getContractFactory('./CommonUpgradeFacet')
    const PolicyCoreFacet = await getContractFactory('./PolicyCoreFacet')
    const PolicyClaimsFacet = await getContractFactory('./PolicyClaimsFacet')
    const PolicyCommissionsFacet = await getContractFactory('./PolicyCommissionsFacet')
    const PolicyPremiumsFacet = await getContractFactory('./PolicyPremiumsFacet')
    const PolicyTranchTokensFacet = await getContractFactory('./PolicyTranchTokensFacet')
    const PolicyApprovalsFacet = await getContractFactory('./PolicyApprovalsFacet')

    addresses = [
      await deploy(getTxParams(), PolicyCoreFacet, settings.address),
      await deploy(getTxParams(), CommonUpgradeFacet, settings.address),
      await deploy(getTxParams(), PolicyClaimsFacet, settings.address),
      await deploy(getTxParams(), PolicyCommissionsFacet, settings.address),
      await deploy(getTxParams(), PolicyPremiumsFacet, settings.address),
      await deploy(getTxParams(), PolicyTranchTokensFacet, settings.address),
      await deploy(getTxParams(), PolicyApprovalsFacet, settings.address),
    ]
    
    for (let f of extraFacets) {
      addresses.push(await deploy(getTxParams(), f, settings.address))
    }

    addresses = addresses.map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving policy implementation addresses to settings`, async task => {
    await settings.setAddresses(settings.address, SETTINGS.POLICY_IMPL, addresses, getTxParams())
  })

  let policyDelegateAddress

  await log.task('Retrieving existing policy delegate', async task => {
    policyDelegateAddress = await settings.getRootAddress(SETTINGS.POLICY_DELEGATE)
    task.log(`Existing policy delegate: ${policyDelegateAddress}`)
  })

  if (policyDelegateAddress === ADDRESS_ZERO) {
    await log.task(`Deploy policy delegate`, async task => {
      const { address } = await deploy(getTxParams(), PolicyDelegate, settings.address)
      policyDelegateAddress = address
      task.log(`Deployed at ${policyDelegateAddress}`)
    })

    await log.task(`Saving policy delegate address ${policyDelegateAddress} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.POLICY_DELEGATE, policyDelegateAddress, getTxParams())
    })
  } else {
    await log.task(`Upgrade policy delegate at ${policyDelegateAddress} with new facets`, async task => {
      const policyDelegate = await IDiamondUpgradeFacet.attach(policyDelegateAddress)

      await execCall({
        task,
        contract: policyDelegate,
        method: 'upgrade',
        args: [addresses],
        ctx,
      })
    })
  }

  return addresses
}


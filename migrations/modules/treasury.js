const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS, BYTES32_ZERO, ADDRESS_ZERO } = require('../../utils/constants')

export const ensureTreasuryIsDeployed = async (cfg) => {
  const { deployer, artifacts, log: baseLog, accounts, settings, entityDeployer, getTxParams = defaultGetTxParams, extraFacets = [] } = cfg
  const log = createLog(baseLog)

  let addresses

  const Treasury = artifacts.require('./Treasury')
  const ITreasury = artifacts.require('./ITreasury')
  const IDiamondUpgradeFacet = artifacts.require('./base/IDiamondUpgradeFacet')

  await log.task(`Deploy Treasury implementations`, async task => {
    const TreasuryUpgradeFacet = artifacts.require('./TreasuryUpgradeFacet')
    const TreasuryCoreFacet = artifacts.require('./TreasuryCoreFacet')

    addresses = [
      await deploy(deployer, getTxParams(), TreasuryUpgradeFacet, settings.address),
      await deploy(deployer, getTxParams(), TreasuryCoreFacet, settings.address),
    ]
    
    for (let f of extraFacets) {
      addresses.push(await deploy(deployer, getTxParams(), f, settings.address))
    }

    addresses = addresses.map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving treasury implementation addresses to settings`, async task => {
    await settings.setAddresses(settings.address, SETTINGS.TREASURY_IMPL, addresses, getTxParams())
  })

  let treasuryAddress
  let treasury

  await log.task('Retrieving existing treasury', async task => {
    treasuryAddress = await settings.getRootAddress(SETTINGS.TREASURY)
    task.log(`Existing treasury: ${treasuryAddress}`)
  })

  if (treasuryAddress === ADDRESS_ZERO) {
    await log.task(`Deploy treasury`, async task => {
      treasury = await deploy(deployer, getTxParams(), Treasury, settings.address)
      task.log(`Deployed at ${treasury.address}`)
    })

    await log.task(`Saving treasury address ${treasuryAddress} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.TREASURY, treasury.address, getTxParams())
    })
  } else {
    await log.task(`Upgrade treasury at ${treasuryAddress} with new facets`, async task => {
      treasury = await IDiamondUpgradeFacet.at(treasuryAddress)

      await execCall({
        task,
        contract: treasury,
        method: 'upgrade',
        args: [addresses],
        cfg,
      })
    })
  }

  return await ITreasury.at(treasury.address)
}

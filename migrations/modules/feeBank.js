const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS, ADDRESS_ZERO } = require('../../utils/constants')

export const ensureFeeBankIsDeployed = async (cfg) => {
  const { deployer, artifacts, log: baseLog, accounts, settings, entityDeployer, getTxParams = defaultGetTxParams, extraFacets = [] } = cfg
  const log = createLog(baseLog)

  let addresses

  const FeeBank = artifacts.require('./FeeBank')
  const IFeeBank = artifacts.require('./IFeeBank')
  const IDiamondUpgradeFacet = artifacts.require('./base/IDiamondUpgradeFacet')

  await log.task(`Deploy Fee bank implementations`, async task => {
    const CommonUpgradeFacet = artifacts.require('./CommonUpgradeFacet')
    const FeeBankCoreFacet = artifacts.require('./FeeBankCoreFacet')

    addresses = [
      await deploy(deployer, getTxParams(), CommonUpgradeFacet, settings.address),
      await deploy(deployer, getTxParams(), FeeBankCoreFacet, settings.address),
    ]

    for (let f of extraFacets) {
      addresses.push(await deploy(deployer, getTxParams(), f, settings.address))
    }

    addresses = addresses.map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving fee bank implementation addresses to settings`, async task => {
    await settings.setAddresses(settings.address, SETTINGS.FEEBANK_IMPL, addresses, getTxParams())
  })

  let feeBankAddress
  let feeBank

  await log.task('Retrieving existing fee bank', async task => {
    feeBankAddress = await settings.getRootAddress(SETTINGS.FEEBANK)
    task.log(`Existing fee bank: ${feeBankAddress}`)
  })

  if (feeBankAddress === ADDRESS_ZERO) {
    await log.task(`Deploy fee bank`, async task => {
      feeBank = await deploy(deployer, getTxParams(), FeeBank, settings.address)
      task.log(`Deployed at ${feeBank.address}`)
    })

    await log.task(`Saving fee bank address ${feeBank.address} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.FEEBANK, feeBank.address, getTxParams())
    })
  } else {
    await log.task(`Upgrade fee bank at ${feeBankAddress} with new facets`, async task => {
      feeBank = await IDiamondUpgradeFacet.at(feeBankAddress)

      await execCall({
        task,
        contract: feeBank,
        method: 'upgrade',
        args: [addresses],
        cfg,
      })
    })
  }

  return await IFeeBank.at(feeBank.address)
}

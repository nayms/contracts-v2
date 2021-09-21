const { createLog } = require('../utils/log')
const { deploy, execCall } = require('../utils')
const { SETTINGS, ADDRESS_ZERO } = require('../../utils/constants')

export const ensureFeeBankIsDeployed = async (ctx) => {
  const { log: baseLog, accounts, settings, entityDeployer, getTxParams, extraFacets = [] } = ctx
  const log = createLog(baseLog)

  let addresses

  const FeeBank = await getContractFactory('./FeeBank')
  const IFeeBank = await getContractFactory('./IFeeBank')
  const IDiamondUpgradeFacet = await getContractFactory('./base/IDiamondUpgradeFacet')

  await log.task(`Deploy Fee bank implementations`, async task => {
    const CommonUpgradeFacet = await getContractFactory('./CommonUpgradeFacet')
    const FeeBankCoreFacet = await getContractFactory('./FeeBankCoreFacet')

    addresses = [
      await deploy(getTxParams(), CommonUpgradeFacet, settings.address),
      await deploy(getTxParams(), FeeBankCoreFacet, settings.address),
    ]

    for (let f of extraFacets) {
      addresses.push(await deploy(getTxParams(), f, settings.address))
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
      feeBank = await deploy(getTxParams(), FeeBank, settings.address)
      task.log(`Deployed at ${feeBank.address}`)
    })

    await log.task(`Saving fee bank address ${feeBank.address} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.FEEBANK, feeBank.address, getTxParams())
    })
  } else {
    await log.task(`Upgrade fee bank at ${feeBankAddress} with new facets`, async task => {
      feeBank = await IDiamondUpgradeFacet.attach(feeBankAddress)

      await execCall({
        task,
        contract: feeBank,
        method: 'upgrade',
        args: [addresses],
        ctx,
      })
    })
  }

  return await IFeeBank.attach(feeBank.address)
}

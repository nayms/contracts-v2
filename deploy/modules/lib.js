import { createLog } from '../utils/log'
import { deployContract, getContractAt, execCall } from '../utils'
import { ADDRESS_ZERO } from '../../utils/constants'

export const deployProxy = async ({
  ctx,
  log,
  friendlyName,
  contractName,
  interfaceName,
  settingsKey,
  facetAddresses,
}) => {
  const { settings, getTxParams } = ctx
  
  let proxyAddress
  let proxy

  await log.task(`Retrieving existing ${friendlyName}`, async task => {
    proxyAddress = await settings.getRootAddress(settingsKey)
    task.log(`Existing ${friendlyName}: ${proxyAddress}`)
  })

  if (proxyAddress === ADDRESS_ZERO) {
    await log.task(`Deploy ${friendlyName}`, async task => {
      proxy = await deployContract(ctx, contractName, settings.address)
      task.log(`Deployed at ${proxy.address}`)
    })

    await log.task(`Saving ${friendlyName} address ${proxy.address} to settings`, async () => {
      await settings.setAddress(settings.address, settingsKey, proxy.address, getTxParams())
    })
  } else {
    await log.task(`Upgrade ${friendlyName} at ${proxyAddress} with latest facets`, async task => {
      proxy = await getContractAt('IDiamondUpgradeFacet', proxyAddress)

      await execCall({
        task,
        contract: proxy,
        method: 'upgrade',
        args: [facetAddresses],
        ctx,
      })
    })
  }

  return await getContractAt(interfaceName, proxy.address)
}

export const deployFacets = async ({
  ctx,
  log,
  friendlyName,
  contractNames,
  settingsKey,
}) => {
  const { settings, getTxParams } = ctx

  let addresses = []

  await log.task(`Deploy ${friendlyName} facets`, async task => {
    if (!contractNames.includes('CommonUpgradeFacet')) {
      contractNames.push('CommonUpgradeFacet')
    }

    for (let f of contractNames) {
      addresses.push(await deployContract(ctx, f, settings.address))
    }

    addresses = addresses.map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving ${friendlyName} implementation addresses to settings`, async task => {
    await settings.setAddresses(settings.address, settingsKey, addresses, getTxParams())
  })

  return addresses
}


export const deployUpgradeableContract = async ({
  ctx,
  friendlyName,
  proxyContractName,
  proxyInterfaceName,
  facetContractNames,
  facetListSettingsKey,
  proxySettingsKey
}) => {
  const { log: baseLog } = ctx
  const log = createLog(baseLog)

  const facetAddresses = await deployFacets({ 
    ctx, 
    log, 
    friendlyName, 
    contractNames: facetContractNames, 
    settingsKey: facetListSettingsKey 
  })

  return await deployProxy({ 
    ctx, 
    log, 
    friendlyName, 
    contractName: proxyContractName,
    interfaceName: proxyInterfaceName, 
    settingsKey: proxySettingsKey, 
    facetAddresses 
  })
}

import { createLog } from '../utils/log'
import { deployContract, getContractAt, execMultisigCall, getMethodExecutor, execMethod } from '../utils'
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
  const { settings } = ctx
  
  let proxyAddress
  let proxy

  await log.task(`Deploy ${friendlyName} proxy`, async task => {
    await task.task(`Retrieving existing proxy`, async task => {
      proxyAddress = await settings.getRootAddress(settingsKey)
      task.log(`Existing proxy: ${proxyAddress}`)
    })

    if (proxyAddress === ADDRESS_ZERO) {
      await task.task(`Deploy contract`, async task => {
        proxy = await deployContract(ctx, contractName, [settings.address])
        task.log(`Deployed at ${proxy.address}`)
      })

      await task.task(`Saving contract address ${proxy.address} to settings`, async t => {
        await execMethod({ ctx, task: t, contract: settings }, 'setAddress', settings.address, settingsKey, proxy.address)
      })
    } else {
      await task.task(`Upgrade contract at ${proxyAddress} with latest facets`, async task => {
        proxy = await getContractAt('IDiamondUpgradeFacet', proxyAddress)

        await execMultisigCall({
          task,
          contract: proxy,
          method: 'upgrade',
          args: [facetAddresses],
          ctx,
        })
      })
    }
  })

  return await getContractAt(interfaceName, proxy.address)
}

export const deployFacets = async ({
  ctx,
  log,
  friendlyName,
  contractNames,
  settingsKey,
}) => {
  const { settings } = ctx

  let addresses = []

  await log.task(`Deploy ${friendlyName} facets`, async task => {
    if (!contractNames.includes('CommonUpgradeFacet')) {
      contractNames.push('CommonUpgradeFacet')
    }

    for (let f of contractNames) {
      addresses.push(await deployContract(ctx, f, [settings.address]))
    }

    addresses = addresses.map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)

    await task.task(`Saving ${friendlyName} implementation addresses to settings`, async t => {
      await execMethod({ ctx, task: t, contract: settings }, 'setAddresses', settings.address, settingsKey, addresses)
    })
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

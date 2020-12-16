const { createLog } = require('../utils/log')
const { SETTINGS } = require('../../utils/constants')
const { execCall } = require('../utils')


const upgradeIfNeeded = async ({ task, item, latestVersionInfo, facetAddresses, logStrPrefix, cfg }) => {
  let needUpgrade = false

  try {
    const itemVersionInfo = await item.getVersionInfo()

    if (!itemVersionInfo.date_) {
      needUpgrade = 'No version info found'
    } else {
      const itemVersionDate = itemVersionInfo.date_.toNumber()

      if (itemVersionDate < latestVersionInfo.date) {
        needUpgrade = `Older version date: ${itemVersionDate}`
      }
    }
  } catch (err) {
    // if it's too old to upgrade
    if (err.message.includes('Number can only safely store')) {
      await task.log(`${logStrPrefix} Too old to upgrade :/`)
      return
    } else {
      throw err
    }
  }

  if (needUpgrade) {
    await task.log(`${logStrPrefix} Requires upgrade: ${needUpgrade}`)

    await execCall({
      task,
      contract: item,
      method: 'upgrade',
      args: [facetAddresses],
      cfg,
    })

    await task.log(`${logStrPrefix} Upgraded!`)
  } else {
    await task.log(`${logStrPrefix} Already up-to-date`)
  }
}


const getImplsVersion = async ({ artifacts, settings, implsKey }) => {
  const addresses = await settings.getRootAddresses(implsKey)

  const IDiamondUpgradeFacet = await artifacts.require('./IDiamondUpgradeFacet')

  for (let i = 0; addresses.length > i; i++) {
    try {
      const facet = await IDiamondUpgradeFacet.at(addresses[i])
      const versionInfo = await facet.getVersionInfo()
      console.log(versionInfo)
      if (versionInfo.num_) {
        const ret = {
          num: versionInfo.num_,
          date: versionInfo.date_.toNumber(),
          hash: versionInfo.hash_,
        }

        return ret
      }
    } catch (err) { 
      console.error(err)
      /* do nothing */ 
    }
  }

  throw new Error('Unable to get current impl version info')
}


export const upgradeExistingConstracts = async (cfg, settingsAddress) => {
  const { artifacts, log: baseLog } = cfg
  const log = createLog(baseLog)

  const Settings = artifacts.require('./ISettings')
  const EntityDeployer = await artifacts.require('./IEntityDeployer')
  const Entity = await artifacts.require('./IEntity')
  const Policy = await artifacts.require('./IPolicy')

  const settings = await Settings.at(settingsAddress)
  const entityDeployerAddress = await settings.getRootAddress(SETTINGS.ENTITY_DEPLOYER)
  const entityImplAddresses = await settings.getRootAddresses(SETTINGS.ENTITY_IMPL)
  const policyImplAddresses = await settings.getRootAddresses(SETTINGS.POLICY_IMPL)
  const entityDeployer = await EntityDeployer.at(entityDeployerAddress)

  await log.task(`Upgrading existing contracts ...`, async task => {
    const latestEntityVersionInfo = await getImplsVersion({ task, artifacts, settings, implsKey: SETTINGS.ENTITY_IMPL })
    await task.log(`Got entity impls version info:\n${JSON.stringify(latestEntityVersionInfo, null, 2)}`)

    const latestPolicyVersionInfo = await getImplsVersion({ task, artifacts, settings, implsKey: SETTINGS.POLICY_IMPL })
    await task.log(`Got policy impls version info:\n${JSON.stringify(latestPolicyVersionInfo, null, 2)}`)

    const numEntities = (await entityDeployer.getNumEntities()).toNumber()
    await task.log(`Got ${numEntities} entities`)

    for (let i = 0; numEntities > i; i += 1) {
      const entityAddress = await entityDeployer.getEntity(i)
      await task.log(`Entity: ${entityAddress}`)

      const entity = await Entity.at(entityAddress)

      await upgradeIfNeeded({
        task,
        item: entity,
        latestVersionInfo: latestEntityVersionInfo,
        facetAddresses: entityImplAddresses,
        logStrPrefix: `--->`,
        cfg,
      })

      let numPolicies

      try {
        numPolicies = (await entity.getNumPolicies()).toNumber()
      } catch (err) {
        await task.log(`--- Entity has old interface, cannot retrieve no. of policies`)
        continue
      }

      await task.log(`--- Entity has ${numPolicies} policies`)

      for (let i = 0; numPolicies > i; i += 1) {
        const policyAddress = await entity.getPolicy(i)
        await task.log(`------ Policy: ${policyAddress}`)

        const policy = await Policy.at(policyAddress)

        await upgradeIfNeeded({
          task,
          item: policy,
          latestVersionInfo: latestPolicyVersionInfo,
          facetAddresses: policyImplAddresses,
          logStrPrefix: `--------->`,
          cfg,
        })
      }
    }
  })
}

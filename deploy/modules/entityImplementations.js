const { createLog } = require('../utils/log')
const { deploy, execCall } = require('../utils')
const { SETTINGS, BYTES32_ZERO, ADDRESS_ZERO } = require('../../utils/constants')

export const ensureEntityImplementationsAreDeployed = async (ctx) => {
  const { log: baseLog, accounts, settings, entityDeployer, getTxParams, extraFacets = [] } = ctx
  const log = createLog(baseLog)

  let addresses

  const EntityDelegate = await getContractFactory('./EntityDelegate')
  const IDiamondUpgradeFacet = await getContractFactory('./base/IDiamondUpgradeFacet')

  await log.task(`Deploy Entity implementations`, async task => {
    const CommonUpgradeFacet = await getContractFactory('./CommonUpgradeFacet')
    const EntityCoreFacet = await getContractFactory('./EntityCoreFacet')
    const EntityTokensFacet = await getContractFactory('./EntityTokensFacet')
    const EntityDividendsFacet = await getContractFactory('./EntityDividendsFacet')
    const EntityTreasuryFacet = await getContractFactory('./EntityTreasuryFacet')
    const EntityTreasuryBridgeFacet = await getContractFactory('./EntityTreasuryBridgeFacet')    

    addresses = [
      await deploy(getTxParams(), CommonUpgradeFacet, settings.address),
      await deploy(getTxParams(), EntityCoreFacet, settings.address),
      await deploy(getTxParams(), EntityTokensFacet, settings.address),
      await deploy(getTxParams(), EntityDividendsFacet, settings.address),
      await deploy(getTxParams(), EntityTreasuryFacet, settings.address),
      await deploy(getTxParams(), EntityTreasuryBridgeFacet, settings.address),
    ]
    
    for (let f of extraFacets) {
      addresses.push(await deploy(getTxParams(), f, settings.address))
    }

    addresses = addresses.map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })

  await log.task(`Saving entity implementation addresses to settings`, async task => {
    await settings.setAddresses(settings.address, SETTINGS.ENTITY_IMPL, addresses, getTxParams())
  })

  let entityDelegateAddress

  await log.task('Retrieving existing entity delegate', async task => {
    entityDelegateAddress = await settings.getRootAddress(SETTINGS.ENTITY_DELEGATE)
    task.log(`Existing entity delegate: ${entityDelegateAddress}`)
  })

  if (entityDelegateAddress === ADDRESS_ZERO) {
    await log.task(`Deploy entity delegate`, async task => {
      const { address } = await deploy(getTxParams(), EntityDelegate, settings.address)
      entityDelegateAddress = address
      task.log(`Deployed at ${entityDelegateAddress}`)
    })

    await log.task(`Saving entity delegate address ${entityDelegateAddress} to settings`, async () => {
      await settings.setAddress(settings.address, SETTINGS.ENTITY_DELEGATE, entityDelegateAddress, getTxParams())
    })
  } else {
    await log.task(`Upgrade entity delegate at ${entityDelegateAddress} with new facets`, async task => {
      const entityDelegate = await IDiamondUpgradeFacet.attach(entityDelegateAddress)

      await execCall({
        task,
        contract: entityDelegate,
        method: 'upgrade',
        args: [addresses],
        ctx,
      })
    })
  }

  if (entityDeployer) {
    let naymsEntityAddress

    const numEntities = await entityDeployer.getNumEntities()
    if (0 == numEntities) {
      await log.task(`Deploy Nayms entity`, async task => {
        await entityDeployer.deploy(entityDeployer.address, BYTES32_ZERO, getTxParams())

        naymsEntityAddress = await entityDeployer.getEntity(0)

        task.log(`Deployed at ${naymsEntityAddress}`)
      })
    } else {
      await log.task('Retrieving existing Nayms entity', async task => {
        naymsEntityAddress = await entityDeployer.getEntity(0)
        task.log(`Existing Nayms entity: ${naymsEntityAddress}`)
      })
    }

    const storedNaymsEntityAddress = await settings.getRootAddress(SETTINGS.NAYMS_ENTITY)
    if (storedNaymsEntityAddress !== naymsEntityAddress) {
      await log.task(`Saving Nayms entity address ${naymsEntityAddress} to settings`, async () => {
        await settings.setAddress(settings.address, SETTINGS.NAYMS_ENTITY, naymsEntityAddress, getTxParams())
      })
    }
  } else {
    log.log('EntityDeployer not provided, skipping deployment of Nayms entity')
  }

  return addresses
}

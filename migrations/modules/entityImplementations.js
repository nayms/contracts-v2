const { createLog } = require('../utils/log')
const { deploy, defaultGetTxParams, execCall } = require('../utils')
const { SETTINGS } = require('../../utils/constants')

export const ensureEntityImplementationsAreDeployed = async (cfg) => {
  const { deployer, artifacts, log: baseLog, accounts, settings, entityDeployer, getTxParams = defaultGetTxParams } = cfg
  const log = createLog(baseLog)

  let addresses

  await log.task(`Deploy Entity implementations`, async task => {
    const EntityUpgradeFacet = artifacts.require('./EntityUpgradeFacet')
    const EntityCoreFacet = artifacts.require('./EntityCoreFacet')

    addresses = [
      await deploy(deployer, getTxParams(), EntityCoreFacet, settings.address),
      await deploy(deployer, getTxParams(), EntityUpgradeFacet, settings.address),
    ].map(c => c.address)

    task.log(`Deployed at ${addresses.join(', ')}`)
  })


  await log.task(`Saving entity implementation addresses to settings`, async task => {
    await execCall({
      task,
      contract: settings,
      method: 'setAddresses',
      args: [settings.address, SETTINGS.ENTITY_IMPL, addresses],
      cfg,
    })
  })

  if (entityDeployer) {
    let naymsEntityAddress
    const numEntities = await entityDeployer.getNumEntities()
    if (0 == numEntities) {
      await log.task(`Deploy Nayms entity`, async task => {
        await entityDeployer.deploy(accounts[0], getTxParams())

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

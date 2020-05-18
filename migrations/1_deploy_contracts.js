const _ = require('lodash')
const path = require('path')
const got = require('got')

const { createLog } = require('../utils/log')
const { getMatchingNetwork } = require('../utils/functions')
const { getCurrentAcl, ensureAclIsDeployed } = require('./modules/acl')
const { getCurrentSettings, ensureSettingsIsDeployed } = require('./modules/settings')
const { getCurrentMarket, ensureMarketIsDeployed } = require('./modules/market')
const { getCurrentEtherToken, ensureEtherTokenIsDeployed } = require('./modules/etherToken')
const { getCurrentEntityDeployer, ensureEntityDeployerIsDeployed } = require('./modules/entityDeployer')
const { ensureEntityImplementationsAreDeployed } = require('./modules/entityImplementations')
const { ensurePolicyImplementationsAreDeployed } = require('./modules/policyImplementations')

const getDeployerWithLiveGasPrice = async ({ deployer, log }) => {
  log(`Fetching live fast gas price ...`)

  const { body: { fast } } = await got('https://ethgasstation.info/api/ethgasAPI.json', { responseType: 'json' })

  const gwei = parseInt(fast, 10) / 10

  log(`... done: ${gwei} GWEI`)

  return {
    deploy: async (...args) => {
      return deployer.deploy(...args, {
        gasPrice: parseInt(gwei * 1000000000, 10)
      })
    }
  }
}

module.exports = async (deployer, network) => {
  const log = createLog(true)

  const doReset = !!process.env.RESET

  let acl
  let settings

  const networkInfo = getMatchingNetwork({ name: network })

  if (true || !networkInfo.isLocal) {
    log('Configuring deployer to use live gas price for public network ...')

    deployer = await getDeployerWithLiveGasPrice({ deployer, log })

    log('... done')
  }

  if (doReset || networkInfo.isLocal) {
    log('Re-deploying all contracts a-new ...')

    await deployer.deploy(artifacts.require("./Migrations"))

    acl = await ensureAclIsDeployed({ deployer, artifacts, logger: true })
    settings = await ensureSettingsIsDeployed({ deployer, artifacts, logger: true }, acl.address)

    await ensureMarketIsDeployed({ deployer, artifacts, logger: true }, settings.address)
    await ensureEtherTokenIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
    await ensureEntityDeployerIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  } else {
    log('Deploying upgrades only ...')

    acl = await getCurrentAcl({ artifacts, network, logger: true })
    settings = await getCurrentSettings({ artifacts, network, logger: true })
    // check the others too
    await getCurrentMarket({ artifacts, network, logger: true })
    await getCurrentEtherToken({ artifacts, network, logger: true })
    await getCurrentEntityDeployer({ artifacts, network, logger: true })
  }

  await ensureEntityImplementationsAreDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await ensurePolicyImplementationsAreDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
}

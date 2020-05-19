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
  let gwei

  await log.task('Fetching live fast gas price', async task => {
    const { body: { fast } } = await got('https://ethgasstation.info/api/ethgasAPI.json', { responseType: 'json' })
    gwei = parseInt(fast, 10) / 10
    task.log(`${gwei} GWEI`)
  })

  return {
    deploy: async (...args) => {
      return deployer.deploy(...args, {
        gasPrice: parseInt(gwei * 1000000000, 10)
      })
    }
  }
}

module.exports = async (deployer, network) => {
  const log = createLog(console.log.bind(console))

  const doFreshDeployment = !!process.env.FRESH

  let acl
  let settings

  const networkInfo = getMatchingNetwork({ name: network })
  const networkId = networkInfo.id

  if (!networkInfo.isLocal) {
    await log.task('Configure deployer to use live gas price', async () => {
      deployer = await getDeployerWithLiveGasPrice({ deployer, log })
    })
  }

  if (doFreshDeployment || networkInfo.isLocal) {
    await log.task('Re-deploying all contracts', async () => {
      acl = await ensureAclIsDeployed({ deployer, artifacts, log })
      settings = await ensureSettingsIsDeployed({ deployer, artifacts, log }, acl.address)

      await Promise.all([
        ensureMarketIsDeployed({ deployer, artifacts, log }, settings.address),
        ensureEtherTokenIsDeployed({ deployer, artifacts, log }, acl.address, settings.address),
        ensureEntityDeployerIsDeployed({ deployer, artifacts, log }, acl.address, settings.address),
      ])
    })
  } else {
    await log.task('Deploying upgrades only', async () => {
      acl = await getCurrentAcl({ artifacts, networkId, log })
      settings = await getCurrentSettings({ artifacts, networkId, log })
      // check the others too
      await Promise.all([
        getCurrentMarket({ artifacts, networkId, log }),
        getCurrentEtherToken({ artifacts, networkId, log }),
        getCurrentEntityDeployer({ artifacts, networkId, log }),
      ])
    })
  }

  await Promise.all([
    ensureEntityImplementationsAreDeployed({ deployer, artifacts, log }, acl.address, settings.address),
    ensurePolicyImplementationsAreDeployed({ deployer, artifacts, log }, acl.address, settings.address),
  ])
}

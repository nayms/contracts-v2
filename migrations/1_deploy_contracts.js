const _ = require('lodash')
const path = require('path')
const got = require('got')

const { createLog } = require('./utils/log')
const { getMatchingNetwork } = require('./utils')
const { getCurrentAcl, ensureAclIsDeployed } = require('./modules/acl')
const { getCurrentSettings, ensureSettingsIsDeployed } = require('./modules/settings')
const { getCurrentMarket, ensureMarketIsDeployed } = require('./modules/market')
const { getCurrentEtherToken, ensureEtherTokenIsDeployed } = require('./modules/etherToken')
const { getCurrentEntityDeployer, ensureEntityDeployerIsDeployed } = require('./modules/entityDeployer')
const { ensureEntityImplementationsAreDeployed } = require('./modules/entityImplementations')
const { ensurePolicyImplementationsAreDeployed } = require('./modules/policyImplementations')
const { upgradeExistingConstracts } = require('./modules/upgrades')

const getLiveGasPrice = async ({ log }) => {
  let gwei

  await log.task('Fetching live fast gas price', async task => {
    const { body: { fast } } = await got('https://ethgasstation.info/api/ethgasAPI.json', { responseType: 'json' })
    gwei = parseInt(parseInt(fast, 10) / 10, 10) + 1
    task.log(`${gwei} GWEI`)
  })

  return gwei
}

module.exports = async (deployer, network, accounts) => {
  const log = createLog(console.log.bind(console))

  const doFreshDeployment = !!process.env.FRESH

  let acl
  let settings

  const networkInfo = getMatchingNetwork({ name: network })
  const networkId = networkInfo.id

  let getTxParams

  if (!networkInfo.isLocal) {
    /*
    - use live gas price for max speed,
    - do manual nonce tracking to avoid infura issues (https://ethereum.stackexchange.com/questions/44349/truffle-infura-on-mainnet-nonce-too-low-error)
    */
    const gwei = await getLiveGasPrice({ log })

    let nonce = await web3.eth.getTransactionCount(accounts[0])

    getTxParams = () => {
      log.log(`Nonce: ${nonce}`)
      nonce += 1
      return {
        gasPrice: gwei * 1000000000,
        nonce: nonce - 1,
      }
    }
  }

  const cfg = {
    deployer,
    artifacts,
    log,
    networkId,
    getTxParams,
    onlyDeployingUpgrades: !(doFreshDeployment || networkInfo.isLocal)
  }

  if (!cfg.onlyDeployingUpgrades) {
    if (networkInfo.isLocal) {
      await deployer.deploy(artifacts.require("./Migrations"))
    }

    await log.task('Re-deploying all contracts', async () => {
      acl = await ensureAclIsDeployed(cfg)
      settings = await ensureSettingsIsDeployed(cfg, acl.address)

      await Promise.all([
        ensureMarketIsDeployed(cfg, settings.address),
        ensureEtherTokenIsDeployed(cfg, acl.address, settings.address),
        ensureEntityDeployerIsDeployed(cfg, acl.address, settings.address),
      ])
    })
  } else {
    await log.task('Deploying upgrades only', async () => {
      [ acl, settings ] = await Promise.all([
        getCurrentAcl(cfg),
        getCurrentSettings(cfg),
        getCurrentMarket(cfg),
        getCurrentEtherToken(cfg),
        getCurrentEntityDeployer(cfg),
      ])
    })
  }

  await ensureEntityImplementationsAreDeployed(cfg, acl.address, settings.address)
  await ensurePolicyImplementationsAreDeployed(cfg, acl.address, settings.address)

  if (cfg.onlyDeployingUpgrades) {
    await upgradeExistingConstracts({ artifacts, log, getTxParams }, settings.address)
  }
}

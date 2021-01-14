const _ = require('lodash')
const path = require('path')
const got = require('got')
const { EthHdWallet } = require('eth-hd-wallet')

const { createLog } = require('./utils/log')
const { getMatchingNetwork, defaultGetTxParams, ADDRESS_ZERO, execCall } = require('./utils')
const { getCurrentAcl, ensureAclIsDeployed, setAclAdminToMultisigAddress } = require('./modules/acl')
const { getCurrentSettings, ensureSettingsIsDeployed } = require('./modules/settings')
const { getCurrentMarket, ensureMarketIsDeployed } = require('./modules/market')
const { getCurrentEtherToken, ensureEtherTokenIsDeployed } = require('./modules/etherToken')
const { getCurrentEntityDeployer, ensureEntityDeployerIsDeployed } = require('./modules/entityDeployer')
const { ensureEntityImplementationsAreDeployed } = require('./modules/entityImplementations')
const { ensurePolicyImplementationsAreDeployed } = require('./modules/policyImplementations')
const { upgradeExistingConstracts } = require('./modules/upgrades')
const { updateDeployedAddressesJson } = require('./utils/postDeployment')

const getLiveGasPrice = async ({ log }) => {
  let gwei

  await log.task('Fetching live fast gas price', async task => {
    const { body } = await got('https://www.ethgasstationapi.com/api/fast', { rejectUnauthorized: false })
    const fast = parseFloat(body)
    gwei = fast + 1
    task.log(`${gwei} GWEI`)
  })

  return gwei
}

module.exports = async (deployer, network, accounts) => {
  const log = createLog(console.log.bind(console))

  const releaseConfig = require('../releaseConfig.json')

  let canMultisig = false

  // check network
  switch (network) {
    case 'mainnet':
      canMultisig = true
      if (!releaseConfig.deployMainnet) {
        throw new Error('Release config does not allow Mainnet deployment')
      }
      break
    case 'rinkeby':
      canMultisig = true
      if (!releaseConfig.deployRinkeby) {
        throw new Error('Release config does not allow Rinkeby deployment')
      }
      break
    default:
      // do nothing
  }

  let hdWallet
  let multisig

  // if trying to do multisig
  if (releaseConfig.multisig && !releaseConfig.freshDeployment) {
    if (!canMultisig) {
      throw new Error(`Cannot use multisig with network: ${network} !`)
    }

    if (!process.env.MNEMONIC) {
      throw new Error('MNEMONIC env var must be set')
    }

    // generate HD wallet for use with multisig signing
    hdWallet = EthHdWallet.fromMnemonic(process.env.MNEMONIC)
    hdWallet.generateAddresses(1)

    // multisig enabled
    multisig = releaseConfig.multisig
  }

  const networkInfo = getMatchingNetwork({ name: network })

  let getTxParams

  if (!networkInfo.isLocal) {
    /*
    - On mainnet, use live gas price for max speed,
    - do manual nonce tracking to avoid infura issues (https://ethereum.stackexchange.com/questions/44349/truffle-infura-on-mainnet-nonce-too-low-error)
    */
    let gwei
    if ('mainnet' === network) {
      gwei = await getLiveGasPrice({ log })
    } else {
      gwei = 2
    }

    let nonce = await web3.eth.getTransactionCount(accounts[0])

    getTxParams = (txParamsOverride = {}) => {
      log.log(`Nonce: ${nonce}`)

      nonce += 1

      return defaultGetTxParams(Object.assign({
        gasPrice: gwei * 1000000000,
        nonce: nonce - 1,
      }, txParamsOverride))
    }
  }

  const cfg = {
    web3,
    deployer,
    artifacts,
    accounts,
    log,
    networkInfo,
    getTxParams,
    onlyDeployingUpgrades: !releaseConfig.freshDeployment,
    multisig,
    hdWallet,
  }

  let acl
  let settings
  let entityDeployer

  if (!cfg.onlyDeployingUpgrades) {
    if (networkInfo.isLocal) {
      await deployer.deploy(artifacts.require("./Migrations"))
    }

    await log.task('Re-deploying all contracts', async () => {
      cfg.acl = await ensureAclIsDeployed(cfg)
      cfg.settings = await ensureSettingsIsDeployed(cfg)

      ;[ cfg.entityDeployer, cfg.market, cfg.etherToken ] = await Promise.all([
        ensureEntityDeployerIsDeployed(cfg),
        ensureMarketIsDeployed(cfg),
        ensureEtherTokenIsDeployed(cfg),
      ])
    })
  } else {
    await log.task('Deploying upgrades only', async () => {
      ;[ cfg.acl, cfg.settings, cfg.entityDeployer, cfg.market, cfg.etherToken ] = await Promise.all([
        getCurrentAcl(cfg),
        getCurrentSettings(cfg),
        getCurrentEntityDeployer(cfg),
        getCurrentMarket(cfg),
        getCurrentEtherToken(cfg),
      ])
    })
  }

  await ensureEntityImplementationsAreDeployed(cfg)
  await ensurePolicyImplementationsAreDeployed(cfg)

  if (!releaseConfig.freshDeployment) {
    await upgradeExistingConstracts(cfg)
  }

  if (releaseConfig.extractDeployedAddresses) {
    await updateDeployedAddressesJson(cfg)
  }

  if (releaseConfig.freshDeployment && releaseConfig.multisig) {
    setAclAdminToMultisigAddress(cfg, releaseConfig.multisig)
    // upgrades following this fresh deployment should use the multisig!
  }
}

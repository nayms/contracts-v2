const _ = require('lodash')
const path = require('path')
const got = require('got')
const { EthHdWallet } = require('eth-hd-wallet')

const { createLog } = require('./utils/log')
const { getMatchingNetwork, defaultGetTxParams, execCall } = require('./utils')
const { ADDRESS_ZERO } = require('../utils/constants')
const { getCurrentAcl, ensureAclIsDeployed, addMultisigAddressAsSystemAdmin } = require('./modules/acl')
const { getCurrentSettings, ensureSettingsIsDeployed } = require('./modules/settings')
const { ensureMarketIsDeployed } = require('./modules/market')
const { ensureFeeBankIsDeployed } = require('./modules/feeBank')
const { getCurrentEntityDeployer, ensureEntityDeployerIsDeployed } = require('./modules/entityDeployer')
const { ensureEntityImplementationsAreDeployed } = require('./modules/entityImplementations')
const { ensurePolicyImplementationsAreDeployed } = require('./modules/policyImplementations')
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

  // check network
  switch (network) {
    case 'mainnet':
      if (releaseConfig.deployNetwork !== 'mainnet') {
        throw new Error('Release config does not allow Mainnet deployment')
      }
      break
    case 'rinkeby':
      if (releaseConfig.deployNetwork !== 'rinkeby') {
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

  if (!cfg.onlyDeployingUpgrades) {
    if (networkInfo.isLocal) {
      await deployer.deploy(artifacts.require("./Migrations"))
    }

    await log.task('Re-deploying all contracts', async () => {
      cfg.acl = await ensureAclIsDeployed(cfg)
      cfg.settings = await ensureSettingsIsDeployed(cfg)

      ;[ cfg.entityDeployer ] = await Promise.all([
        ensureEntityDeployerIsDeployed(cfg),
      ])
    })
  } else {
    await log.task('Deploying upgrades only', async () => {
      ;[ cfg.acl, cfg.settings, cfg.entityDeployer ] = await Promise.all([
        getCurrentAcl(cfg),
        getCurrentSettings(cfg),
        getCurrentEntityDeployer(cfg),
      ])
    })
  }

  cfg.market = await ensureMarketIsDeployed(cfg)
  cfg.feeBank = await ensureFeeBankIsDeployed(cfg)

  await ensureEntityImplementationsAreDeployed(cfg)
  await ensurePolicyImplementationsAreDeployed(cfg)

  if (releaseConfig.extractDeployedAddresses) {
    await updateDeployedAddressesJson(cfg)
  }

  if (releaseConfig.freshDeployment && releaseConfig.multisig) {
    await addMultisigAddressAsSystemAdmin(cfg, {
      multisig: releaseConfig.multisig,
      // on rinkeby we append, on mainnet we replace
      replaceExisting: (releaseConfig.deployNetwork === 'mainnet'),
    })
  }
} 

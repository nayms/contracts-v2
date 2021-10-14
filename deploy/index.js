import { EthHdWallet } from 'eth-hd-wallet'
import { createLog, getMatchingNetwork, buildGetTxParamsHandler, updateDeployedAddressesJson, getAccounts } from './utils'
import { getCurrentAcl, ensureAclIsDeployed, addMultisigAddressAsSystemAdmin } from './modules/acl'
import { getCurrentSettings, ensureSettingsIsDeployed } from './modules/settings'
import { getCurrentEntityDeployer, ensureEntityDeployerIsDeployed } from './modules/entityDeployer'
import { ensureMarketIsDeployed } from './modules/market'
import { ensureFeeBankIsDeployed } from './modules/feeBank'
import { ensureEntityImplementationsAreDeployed } from './modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from './modules/policyImplementations'

async function main() {
  // copy artifacts
  require('../scripts/copyArtifacts')

  // setup logger
  const log = createLog(console.log.bind(console))

  // load release config
  const releaseConfig = require('../releaseConfig.json')

  // load and check network
  const network = getMatchingNetwork(await hre.ethers.provider.getNetwork())

  switch (network.name) {
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
    hdWallet.generateAddresses(2)

    // multisig enabled
    multisig = releaseConfig.multisig
  }

  const accounts = await getAccounts()

  // getTxParams() handler
  const getTxParams = await buildGetTxParamsHandler(network, { log })

  // context ctx
  const ctx = {
    artifacts,
    accounts,
    log,
    network,
    getTxParams,
    onlyDeployingUpgrades: !releaseConfig.freshDeployment,
    multisig,
    hdWallet,
  }

  if (!ctx.onlyDeployingUpgrades) {
    await log.task('Re-deploying all contracts', async () => {
      ctx.acl = await ensureAclIsDeployed(ctx)
      ctx.settings = await ensureSettingsIsDeployed(ctx)

      ;[ctx.entityDeployer] = await Promise.all([
        ensureEntityDeployerIsDeployed(ctx),
      ])
    })
  } else {
    await log.task('Deploying upgrades only', async () => {
      ;[ctx.acl, ctx.settings, ctx.entityDeployer] = await Promise.all([
        getCurrentAcl(ctx),
        getCurrentSettings(ctx),
        getCurrentEntityDeployer(ctx),
      ])
    })
  }

  ctx.market = await ensureMarketIsDeployed(ctx)
  ctx.feeBank = await ensureFeeBankIsDeployed(ctx)

  await ensureEntityImplementationsAreDeployed(ctx)
  await ensurePolicyImplementationsAreDeployed(ctx)

  if (releaseConfig.extractDeployedAddresses) {
    await updateDeployedAddressesJson(ctx)
  }

  // add multisig as sysadmin
  if (releaseConfig.freshDeployment && releaseConfig.multisig) {
    await addMultisigAddressAsSystemAdmin(ctx, {
      multisig: releaseConfig.multisig,
      // on rinkeby we append, on mainnet we replace
      replaceExisting: (releaseConfig.deployNetwork === 'mainnet'),
    })
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
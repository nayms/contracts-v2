const { createLog } = require('./log')
const { deploy } = require('./functions')

export const ensureEtherTokenIsDeployed = async ({ deployer, artifacts, logger }, aclAddress) => {
  const log = createLog(logger)

  log('Deploying EtherToken ...')
  const EtherToken = artifacts.require('./EtherToken')
  const etherToken = await deploy(deployer, EtherToken, aclAddress)
  log(`... deployed at ${etherToken.address}`)

  return etherToken
}

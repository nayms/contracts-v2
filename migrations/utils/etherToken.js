const { createLog } = require('./log')

export const ensureEtherTokenIsDeployed = async ({ deployer, artifacts, logger }, aclAddress) => {
  const log = createLog(logger)

  log('Deploying EtherToken ...')

  const EtherToken = artifacts.require('./base/EtherToken')

  let etherToken
  if (deployer) {
    await deployer.deploy(EtherToken, aclAddress)
    etherToken = await EtherToken.deployed()
    log(`... deployed at ${etherToken.address}`)
  } else {
    etherToken = await EtherToken.new(aclAddress)
    log(`... deployed at ${etherToken.address}`)
  }

  return etherToken
}

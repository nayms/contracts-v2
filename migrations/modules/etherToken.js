const { createLog } = require('../../utils/log')
const { deploy } = require('../../utils/functions')

export const ensureEtherTokenIsDeployed = async ({ deployer, artifacts, logger }, aclAddress, settingsAddress) => {
  const log = createLog(logger)

  log('Deploying EtherToken ...')
  const EtherToken = artifacts.require('./EtherToken')
  const etherToken = await deploy(deployer, EtherToken, aclAddress, settingsAddress)
  log(`... deployed at ${etherToken.address}`)

  return etherToken
}

export const deployNewEtherToken = async ({ artifacts }, aclAddress, settingsAddress) => {
  const EtherToken = artifacts.require('./EtherToken')
  return await EtherToken.new(aclAddress, settingsAddress)
}

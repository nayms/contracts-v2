const Web3 = require('web3')
const EntityImpl = artifacts.require("./EntityImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const EntityDeployer = artifacts.require("./EntityDeployer")

const { ensureAclIsDeployed } = require('./modules/acl')
const { ensureMarketIsDeployed } = require('./modules/market')
const { ensureSettingsIsDeployed } = require('./modules/settings')
const { ensureEtherTokenIsDeployed } = require('./modules/etherToken')

module.exports = async deployer => {
  const web3 = new Web3(deployer.provider)
  const accounts = await web3.eth.getAccounts()

  const acl = await ensureAclIsDeployed({ deployer, artifacts, logger: true })
  const settings = await ensureSettingsIsDeployed({ deployer, artifacts, logger: true }, acl.address)
  await ensureEtherTokenIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await ensureMarketIsDeployed({ deployer, artifacts, logger: true }, settings.address)

  await deployer.deploy(EntityImpl, acl.address, settings.address)
  await deployer.deploy(EntityDeployer, acl.address, settings.address, EntityImpl.address)
  await deployer.deploy(PolicyImpl, acl.address, settings.address)
}

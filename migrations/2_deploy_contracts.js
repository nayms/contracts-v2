const Web3 = require('web3')
const EntityImpl = artifacts.require("./EntityImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const EntityDeployer = artifacts.require("./EntityDeployer")

const { ensureAclIsDeployed } = require('./utils/acl')
const { ensureMarketIsDeployed } = require('./utils/market')
const { ensureSettingsIsDeployed } = require('./utils/settings')
const { ensureEtherTokenIsDeployed } = require('./utils/etherToken')
const { ensureErc1820RegistryIsDeployed } = require('./utils/erc1820')

module.exports = async deployer => {
  const web3 = new Web3(deployer.provider)
  const accounts = await web3.eth.getAccounts()

  await ensureErc1820RegistryIsDeployed({ artifacts, web3, accounts, logger: true })

  const acl = await ensureAclIsDeployed({ deployer, artifacts, logger: true })
  const settings = await ensureSettingsIsDeployed({ deployer, artifacts, logger: true }, acl.address)
  await ensureEtherTokenIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await ensureMarketIsDeployed({ deployer, artifacts, logger: true }, settings.address)

  await deployer.deploy(EntityImpl, acl.address, settings.address)
  await deployer.deploy(EntityDeployer, acl.address, settings.address, EntityImpl.address)
  await deployer.deploy(PolicyImpl, acl.address, settings.address)
}

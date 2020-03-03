const Web3 = require('web3')
const EntityImpl = artifacts.require("./EntityImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const EntityDeployer = artifacts.require("./EntityDeployer")

const { deployAcl } = require('./modules/acl')
const { deployMarket } = require('./modules/market')
const { deploySettings } = require('./modules/settings')
const { deployEtherToken } = require('./modules/etherToken')

module.exports = async deployer => {
  const web3 = new Web3(deployer.provider)
  const accounts = await web3.eth.getAccounts()

  const acl = await deployAcl({ deployer, artifacts, logger: true })
  const settings = await deploySettings({ deployer, artifacts, logger: true }, acl.address)
  await deployEtherToken({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await deployMarket({ deployer, artifacts, logger: true }, settings.address)

  await deployer.deploy(EntityImpl, acl.address, settings.address)
  await deployer.deploy(EntityDeployer, acl.address, settings.address, EntityImpl.address)
  await deployer.deploy(PolicyImpl, acl.address, settings.address)
}

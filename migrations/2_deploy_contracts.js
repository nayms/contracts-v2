const Web3 = require('web3')
const ACL = artifacts.require("./base/ACL")
const EntityImpl = artifacts.require("./EntityImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const EntityDeployer = artifacts.require("./EntityDeployer")

const { ensureAclIsDeployed } = require('./utils/acl')
const { ensureEtherTokenIsDeployed } = require('./utils/etherToken')
const { ensureErc1820RegistryIsDeployed } = require('./utils/erc1820')

module.exports = async deployer => {
  const web3 = new Web3(deployer.provider)
  const accounts = await web3.eth.getAccounts()

  const acl = await ensureAclIsDeployed({ deployer, artifacts, logger: true })
  await ensureEtherTokenIsDeployed({ deployer, artifacts, logger: true }, acl.address)
  await ensureErc1820RegistryIsDeployed({ artifacts, web3, accounts, logger: true })

  await deployer.deploy(PolicyImpl, ACL.address)
  await deployer.deploy(EntityImpl, ACL.address)
  await deployer.deploy(EntityDeployer, ACL.address, EntityImpl.address)
}

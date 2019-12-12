const ACL = artifacts.require("./base/ACL")
const EntityImpl = artifacts.require("./EntityImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const EntityDeployer = artifacts.require("./EntityDeployer")

const { deployAcl } = require('./utils/acl')

module.exports = async deployer => {
  await deployAcl({ deployer, artifacts })
  await deployer.deploy(PolicyImpl, ACL.address)
  await deployer.deploy(EntityImpl, ACL.address)
  await deployer.deploy(EntityDeployer, ACL.address, EntityImpl.address)
}

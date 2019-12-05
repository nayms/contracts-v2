const ACL = artifacts.require("./base/ACL")
const EtherToken = artifacts.require("./base/EtherToken")
const PolicyImpl = artifacts.require("./PolicyImpl")
const PolicyDeployer = artifacts.require("./PolicyDeployer")

const { deployAcl } = require('./utils/acl')

module.exports = async deployer => {
  await deployAcl({ deployer, artifacts })
  await deployer.deploy(PolicyImpl, ACL.address)
  await deployer.deploy(PolicyDeployer, ACL.address, PolicyImpl.address)
}

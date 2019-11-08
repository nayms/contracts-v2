const ACL = artifacts.require("./base/ACL")
const EtherToken = artifacts.require("./base/EtherToken")
const FUCImpl = artifacts.require("./FUCImpl")
const FUCDeployer = artifacts.require("./FUCDeployer")

module.exports = async deployer => {
  await deployer.deploy(ACL)
  await deployer.deploy(FUCImpl, ACL.address, "fucImplementation")
  await deployer.deploy(FUCDeployer, ACL.address, FUCImpl.address)
}

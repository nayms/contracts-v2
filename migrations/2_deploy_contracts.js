const ACL = artifacts.require("./base/ACL.sol")
const FUCImpl = artifacts.require("./FUCImpl.sol")
const FUCDeployer = artifacts.require("./FUCDeployer.sol")

module.exports = async deployer => {
  await deployer.deploy(ACL)
  await deployer.deploy(FUCImpl, ACL.address, "fucImplementation")
  await deployer.deploy(FUCDeployer, ACL.address, FUCImpl.address)
}

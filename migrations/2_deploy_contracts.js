const ACL = artifacts.require("./base/ACL")
const EtherToken = artifacts.require("./base/EtherToken")
const FUCImpl = artifacts.require("./FUCImpl")
const FUCDeployer = artifacts.require("./FUCDeployer")
const MatchingMarket = artifacts.require("./MatchingMarket")

module.exports = async deployer => {
  await deployer.deploy(ACL)
  await deployer.deploy(FUCImpl, ACL.address, "fucImplementation")
  await deployer.deploy(FUCDeployer, ACL.address, FUCImpl.address)
  await deployer.deploy(MatchingMarket, '0xFFFFFFFFFFFFFFFF')
}

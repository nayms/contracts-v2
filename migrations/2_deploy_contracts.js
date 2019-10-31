const Web3  = require('web3')
const chalk = require('chalk')

const { networks } = require('../truffle-config.js')
const { ensureErc1820RegistryIsDeployed } = require('./utils')

const ACL = artifacts.require("./base/ACL.sol")
const FUCImpl = artifacts.require("./FUCImpl.sol")
const FUCDeployer = artifacts.require("./FUCDeployer.sol")

const log = msg => console.log(chalk.blue(msg))

module.exports = async (deployer, network, accounts) => {
  if ('development' === network) {
    const { provider } = (networks[network] || {})

    if (!provider) {
      throw new Error(`Unable to find provider for network: ${network}`)
    }

    await ensureErc1820RegistryIsDeployed({ artifacts, accounts, web3: new Web3(provider) })
  }

  await deployer.deploy(ACL)
  await deployer.deploy(FUCImpl, ACL.address, "fucImplementation")
  await deployer.deploy(FUCDeployer, ACL.address, FUCImpl.address)

  if (network !== 'coverage') {
    const MatchingMarket = artifacts.require("./MatchingMarket.sol")
    await deployer.deploy(MatchingMarket, '0xFFFFFFFFFFFFFFFF')
  }
}

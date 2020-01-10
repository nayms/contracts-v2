const { keccak256 } = require('js-sha3')

exports.sha3 = a => `0x${keccak256(a)}`

exports.deploy = async (deployer, Contract, constructorArgs) => {
  if (deployer) {
    await deployer.deploy(Contract, ...constructorArgs)
    return await Contract.deployed()
  } else {
    return await Contract.new(...constructorArgs)
  }
}
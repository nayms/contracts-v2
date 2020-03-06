const { keccak256: sha3 } = require('js-sha3')

exports.keccak256 = a => `0x${sha3(a)}`

exports.deploy = async (deployer, Contract, ...constructorArgs) => {
  if (deployer) {
    await deployer.deploy(Contract, ...constructorArgs)
    return await Contract.deployed()
  } else {
    return await Contract.new(...constructorArgs)
  }
}
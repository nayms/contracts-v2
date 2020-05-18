const { keccak256: sha3 } = require('js-sha3')
const path = require('path')

const { createLog } = require('./log')
const { networks } = require('../truffle-config.js')

exports.keccak256 = a => `0x${sha3(a)}`

exports.deploy = async (deployer, Contract, ...constructorArgs) => {
  if (deployer) {
    await deployer.deploy(Contract, ...constructorArgs)
    return await Contract.deployed()
  } else {
    return await Contract.new(...constructorArgs)
  }
}

exports.getCurrentInstance = async ({ artifacts, lookupType, type, network, logger }) => {
  const log = createLog(logger)

  const Type = artifacts.require(`./${type}`)

  log(`Loading ${lookupType} address from deployed address list ...`)

  const addresses = require(path.join(__dirname, '..', 'deployedAddresses.json'))
  const inst = Type.at(_.get(addresses, `${lookupType}.${network}.address`))

  log(`... done: ${inst.address}`)

  return inst
}


exports.getMatchingNetwork = ({ network_id, name }) => {
  let match

  if (name) {
    match = Object.keys(networks).find(k => k === name)
  } else if (network_id) {
    match = Object.keys(networks).find(k => networks[k].network_id === network_id)
  }

  if (!match) {
    return null
  }

  return Object.assign({
    name,
    network_id,
  }, networks[match], {
    isLocal: (networks[match].network_id == '*' || networks[match].network_id > 50)
  })
}

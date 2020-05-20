const { keccak256: sha3 } = require('js-sha3')
const path = require('path')

const { createLog } = require('./log')

exports.keccak256 = a => `0x${sha3(a)}`

exports.defaultGetTxParams = () => ({
  gasPrice: 1 * 1000000000 // 1 GWEI
})

exports.deploy = async (deployer, txParams, Contract, ...constructorArgs) => {
  if (deployer) {
    await deployer.deploy(Contract, ...constructorArgs.concat(txParams))
    return await Contract.deployed()
  } else {
    return await Contract.new(...constructorArgs.concat(txParams))
  }
}

exports.getCurrentInstance = async ({ artifacts, lookupType, type, networkId, log }) => {
  log = createLog(log)

  const Type = artifacts.require(`./${type}`)

  let inst

  await log.task(`Loading ${lookupType} address from deployed address list for network ${networkId}`, async task => {
    const addresses = require(path.join(__dirname, '..', 'deployedAddresses.json'))
    inst = await Type.at(_.get(addresses, `${lookupType}.${networkId}.address`))
    task.log(`Instance: ${inst.address}`)
  })

  return inst
}


exports.getMatchingNetwork = ({ network_id, name }) => {
  let match

  const { networks } = require('../truffle-config.js')

  if (name) {
    match = Object.keys(networks).find(k => k === name)
  } else if (network_id) {
    match = Object.keys(networks).find(k => networks[k].network_id == network_id)
  }

  if (!match) {
    throw new Error(`Could not find matching network for either ${network_id} OR ${name}`)
  }

  return Object.assign({
    name: match,
    id: networks[match].network_id,
  }, networks[match], {
    isLocal: (networks[match].network_id == '*' || networks[match].network_id > 50)
  })
}

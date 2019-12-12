const contracts = {
  Proxy: require('./build/contracts/Proxy.json'),
  IACL: require('./build/contracts/IACL.json'),
  IEntityDeployer: require('./build/contracts/IEntityDeployer.json'),
  IEntityImpl: require('./build/contracts/IEntityImpl.json'),
  IPolicyImpl: require('./build/contracts/IPolicyImpl.json'),
  IERC20: require('./build/contracts/IERC20.json'),
  IERC777: require('./build/contracts/IERC777.json'),
}

const extractEventsFromAbis = abis => abis.reduce((output, contract) => {
  contract.abi.filter(({ type, name }) => type === 'event').forEach(e => {
    if (output[e.name]) {
      throw new Error(`Already got an event named ${e.name}`)
    }
    output[e.name] = e
  })
  return output
}, {})

module.exports = {
  addresses: require('./deployedAddresses.json'),
  constants: require('./constants.js'),
  contracts,
  events: extractEventsFromAbis(Object.values(contracts)),
  extractEventsFromAbis,
}

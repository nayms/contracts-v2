let deployedAddresses
try {
  deployedAddresses = require('./deployedAddresses.json')
} catch (_ignore) {}

const rawContracts = require('./contracts.generated.js')

const { ROLES, ROLEGROUPS } = require('./utils/constants')

const coreContracts = [
  { name: 'Settings', actual: 'ISettingsImpl' },
  { name: 'ACL', actual: 'IACL' },
  { name: 'Policy', actual: 'IPolicyImpl' },
  { name: 'EntityDeployer', actual: 'IEntityDeployer' },
  { name: 'Entity', actual: 'IEntityImpl' },
  { name: 'Market', actual: 'IMarket' },
  { name: 'EtherToken', actual: 'IEtherToken' },
  { name: 'Proxy', actual: 'Proxy' },
  { name: 'ERC20', actual: 'IERC20' },
  { name: 'ERC777', actual: 'IERC777' },
].reduce((m, n) => {
  m[n.name] = rawContracts[n.actual]
  return m
}, {})

const extractEventsFromAbis = abis => abis.reduce((output, contract) => {
  contract.abi.filter(({ type, name }) => type === 'event').forEach(e => {
    if (!output[e.name]) {
      output[e.name] = e
    }
  })
  return output
}, {})

module.exports = {
  addresses: deployedAddresses,
  contracts: coreContracts,
  rawContracts,
  events: extractEventsFromAbis(Object.values(coreContracts)),
  extractEventsFromAbis,
  ROLES,
  ROLEGROUPS,
}

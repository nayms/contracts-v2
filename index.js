let deployedAddresses
try {
  deployedAddresses = require('./deployedAddresses.json')
} catch (_ignore) {}

const buildConfig = require('./buildConfig.json')

const rawContracts = require('./contracts.generated.js')

const { ROLES, ROLEGROUPS } = require('./utils/constants')

const coreContracts = [
  { name: 'AccessControl', actual: 'AccessControl' },
  { name: 'Settings', actual: 'ISettings' },
  { name: 'ACL', actual: 'IACL' },
  { name: 'Policy', actual: 'IPolicy' },
  { name: 'EntityDeployer', actual: 'IEntityDeployer' },
  { name: 'Entity', actual: 'IEntity' },
  { name: 'Market', actual: 'IMarket' },
  { name: 'EtherToken', actual: 'IEtherToken' },
  { name: 'ERC20', actual: 'IERC20' },
].reduce((m, n) => {
  m[n.name] = rawContracts[n.actual]
  return m
}, {})

const extractEventsFromAbis = abis => abis.reduce((output, contract) => {
  contract.abi.filter(({ type }) => type === 'event').forEach(e => {
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
  buildConfig,
  events: extractEventsFromAbis(Object.values(rawContracts)),
  extractEventsFromAbis,
  ROLES,
  ROLEGROUPS,
}

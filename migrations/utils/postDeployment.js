const fs = require('fs')
const path = require('path')

const { getMatchingNetwork } = require('.')

export const updateDeployedAddressesJson = () => {
  console.log('Updating deployedAddresses.json ...')

  const projectDir = path.join(__dirname, '..', '..')
  const deployedAddressesJsonPath = path.join(projectDir, 'deployedAddresses.json')
  const currentAddresses = require(deployedAddressesJsonPath)

  const raw = [
    'ACL',
    'EntityDeployer',
    'MatchingMarket',
    'Settings',
    'EtherToken',
  ].reduce((m, name) => {
    const jsonPath = path.join(projectDir, 'build', 'contracts', `${name}.json`)
    const { networks } = require(jsonPath)
    Object.keys(networks).forEach(key => {
      switch (key) {
        case '1': // mainnet
        case '3': // ropsten
        case '4': // rinkeby
        case '5': // goerli
        case '42': // kovan
          break
        default:
          delete networks[key]
      }
    })

    m[name] = networks

    return m
  }, {})

  const final = currentAddresses

  Object.keys(raw).forEach(name => {
    final[name] = final[name] || {}

    Object.keys(raw[name]).forEach(networkId => {
      const theNetwork = getMatchingNetwork({ network_id: networkId })

      final[name][theNetwork.id] = Object.assign({}, final[name][networkId], {
        address: raw[name][networkId].address,
        transactionHash: raw[name][networkId].transactionHash,
      })
    })
  })

  fs.writeFileSync(deployedAddressesJsonPath, JSON.stringify(final, null, 2))
}

const fs = require('fs')
const path = require('path')

const { createLog } = require('./log')

export const updateDeployedAddressesJson = async cfg => {
  const { log: baseLog, networkInfo: { id: networkId } } = cfg

  const log = createLog(baseLog)

  await log.task('Update deployedAddresses.json', async task => {
    const projectDir = path.join(__dirname, '..', '..')
    const deployedAddressesJsonPath = path.join(projectDir, 'deployedAddresses.json')
    const currentAddresses = require(deployedAddressesJsonPath)
    const final = currentAddresses

    const MAP = {
      ACL: 'acl',
      Settings: 'settings',
      EntityDeployer: 'entityDeployer',
      EtherToken: 'etherToken',
    }

    Object.keys(MAP).forEach(name => {
      final[name] = final[name] || {}

      task.log(`Updating ${name} address for network ${networkId} to: ${cfg[MAP[name]].address}`)

      final[name][networkId] = Object.assign({}, final[name][networkId], {
        address: cfg[MAP[name]].address,
      })
    })

    task.log('Writing JSON file ...')

    fs.writeFileSync(deployedAddressesJsonPath, JSON.stringify(final, null, 2))
  })
}

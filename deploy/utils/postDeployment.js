import fs from 'fs'
import path from 'path'
import { createLog } from './log'

export const updateDeployedAddressesJson = async ctx => {
  const { log: baseLog, networkInfo: { id: networkId } } = ctx

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
      Market: 'market',
      FeeBank: 'feeBank'
    }

    Object.keys(MAP).forEach(name => {
      final[name] = final[name] || {}

      task.log(`Updating ${name} address for network ${networkId} to: ${ctx[MAP[name]].address}`)

      final[name][networkId] = Object.assign({}, final[name][networkId], {
        address: ctx[MAP[name]].address,
      })
    })

    task.log('Writing JSON file ...')

    fs.writeFileSync(deployedAddressesJsonPath, JSON.stringify(final, null, 2))
  })
}

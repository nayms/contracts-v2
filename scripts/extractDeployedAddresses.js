#!/usr/bin/env node

/* This script extracts deployed addresses from build folder and puts them into deployedAddresses.json */

const fs = require('fs')
const path = require('path')

const { getMatchingNetwork } = require('../migrations/utils')

if (!process.env.FRESH) {
  console.warn('FRESH environment variable NOT SET so assuming you just wanted to upgrade, and thus will not update deployedAddresses.json!')
  process.exit(0)
}

const projectDir = path.join(__dirname, '..')
const deployedAddressesJsonPath = path.join(projectDir, 'deployedAddresses.json')

const currentAddresses = require('../deployedAddresses.json')

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

    final[name][theNetwork.id] = {
      ...final[name][networkId],
      address: raw[name][networkId].address,
      transactionHash: raw[name][networkId].transactionHash,
    }
  })
})

fs.writeFileSync(deployedAddressesJsonPath, JSON.stringify(final, null, 2))

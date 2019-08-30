#!/usr/bin/env node

/* This script extracts deployed addresses from build folder and puts them into deployedAddresses.json */

const fs = require('fs')
const path = require('path')

const projectDir = path.join(__dirname, '..')
const deployedAddressesJsonPath = path.join(projectDir, 'deployedAddresses.json')

const contracts = [
  'Storage'
].reduce((m, name) => {
  const jsonPath = path.join(projectDir, 'build', 'contracts', `${name}.json`)
  const { networks } = require(deployerJsonPath)
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

fs.writeFileSync(deployedAddressesJsonPath, JSON.stringify(contracts, null, 2))

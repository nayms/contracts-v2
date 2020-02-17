#!/usr/bin/env node

/* This script generates the admin dapp */

const _ = require('lodash')
const fs = require('fs')
const path = require('path')

const projectDir = path.join(__dirname, '..')
const addresses = require(path.join(projectDir, 'deployedAddresses.json'))
const dapp = require(path.join(projectDir, 'contracts', 'admin.json'))

Object.keys(addresses).forEach(contractName => {
  const n = `${_.camelCase(contractName)}Address`

  dapp.constants = dapp.constants || {}
  dapp.constants[n] = dapp.constants[n] || { default: '' }

  Object.keys(addresses[contractName]).forEach(networkId => {
    dapp.constants[n][networkId] = addresses[contractName][networkId].address
  })
})

fs.writeFileSync(path.join(projectDir, 'dapp-generated.json'), JSON.stringify(dapp, null, 2), 'utf-8')

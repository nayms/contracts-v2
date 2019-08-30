#!/usr/bin/env node

/* This script injects deployed addresses into build folder JSO from deployedAddresses.json */

const fs = require('fs')
const path = require('path')

const projectDir = path.join(__dirname, '..')
const deployedAddressesJsonPath = path.join(projectDir, 'deployedAddresses.json')

const contracts = require(deployedAddressesJsonPath)

Object.keys(contracts).forEach(name => {
  const jsonPath = path.join(projectDir, 'build', 'contracts', `${name}.json`)
  const json = require(jsonPath)
  json.networks = {
    ...json.networks,
    ...contracts[name],
  }
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2))
}

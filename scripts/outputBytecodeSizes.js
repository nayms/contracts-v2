#!/usr/bin/env node

/* This script outputs bytecode / deployedBytecode sizes of all compiled contracts */

const fs = require('fs')
const glob = require('glob')
const path = require('path')

const projectDir = path.join(__dirname, '..')
const contractsFolder = path.join(projectDir, 'build', 'contracts')

const files = glob.sync(path.join(contractsFolder, '*.json'))

files.forEach(f => {
  const fileName = path.basename(f, '.json')
  const { contractName, bytecode, deployedBytecode } = require(path.join(contractsFolder, fileName))
  console.log(`${contractName.padEnd(30)} ${`${bytecode.length}`.padStart(7)} bytes`)
})

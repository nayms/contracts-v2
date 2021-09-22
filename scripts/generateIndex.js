#!/usr/bin/env node

/* This script generates the root contract index based on the contents of build/contracts */

const fs = require('fs')
const glob = require('glob')
const path = require('path')

const projectDir = path.join(__dirname, '..')
const contractsFolder = path.join(projectDir, 'artifacts', 'contracts')

const files = glob.sync(path.join(contractsFolder, '**/*.json'))
  .filter(f => !f.includes('.dbg.json'))

const json = files.map(f => {
  const relPath = path.relative(contractsFolder, f)
  const fileName = path.basename(f, '.json')
  return `"${fileName}": require("./artifacts/contracts/${relPath}"),`
}).join("\n")

fs.writeFileSync(path.join(projectDir, 'contracts.generated.js'), `module.exports = {\n${json}\n};`)

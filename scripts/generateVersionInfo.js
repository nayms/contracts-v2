#!/usr/bin/env node

/* This script generates the root contract index based on the contents of build/contracts */

const fs = require('fs')
const glob = require('glob')
const path = require('path')
const git = require('git-last-commit')

const projectDir = path.join(__dirname, '..')
const buildConfigFile = path.join(projectDir, 'buildConfig.json')
const versionInfoContract = path.join(projectDir, 'contracts', 'VersionInfo.sol')

async function main () {
  // update build info
  const buildInfo = require(buildConfigFile)
  buildInfo.num += 1

  const ci = await new Promise((resolve, reject) => {
    git.getLastCommit(function (err, commit) {
      if (err) return reject(err)
      resolve(commit)
    })
  })

  buildInfo.hash = ci.hash
  buildInfo.date = new Date()

  fs.writeFileSync(buildConfigFile, JSON.stringify(buildInfo, null, 2), 'utf8')

  fs.writeFileSync(versionInfoContract, `pragma solidity >=0.6.7;

abstract contract VersionInfo {
  uint256 constant public VERSION_NUM = ${buildInfo.num};
  uint256 constant public VERSION_DATE = ${parseInt(buildInfo.date.getTime() / 1000, 10)};
  string constant public VERSION_GITCOMMIT = "${buildInfo.hash}";
}
`, 'utf8')

  console.log(`VersionInfo.sol written!

${JSON.stringify(buildInfo, null, 2)}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

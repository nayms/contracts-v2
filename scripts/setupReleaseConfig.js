#!/usr/bin/env node

/* This script generates the root contract index based on the contents of build/contracts */

const fs = require('fs')
const glob = require('glob')
const path = require('path')
const git = require('git-last-commit')

const projectDir = path.join(__dirname, '..')
const packageJsonFile = path.join(projectDir, 'package.json')
const releaseConfigFile = path.join(projectDir, 'releaseConfig.json')
const commonUpgradeFacetContract = path.join(projectDir, 'contracts', 'CommonUpgradeFacet.sol')

const GNOSIS_SAFES = {
  rinkeby: '0x52A1A89bF7C028f889Bf57D50aEB7B418c2Fc79B',
  mainnet: '0x4e486E3838aD79acf7fb9AdD9F5519D2D0e9d79A',
}

const network = process.env.NETWORK || 'local'
const isForTesting = network === 'local'
const pullRequestUrl = process.env.CIRCLE_PULL_REQUEST

let pullRequestNum
if (pullRequestUrl) {
  pullRequestNum = pullRequestUrl.substr(pullRequestUrl.lastIndexOf('/') + 1)
}

const buildNum = process.env.CIRCLE_BUILD_NUM || `dev${Date.now()}`

async function main () {
  const ci = await new Promise((resolve, reject) => {
    git.getLastCommit(function (err, commit) {
      if (err) return reject(err)
      resolve(commit)
    })
  })

  const releaseInfo = {}

  if ((!isForTesting) && (network || pullRequestNum)) {
    if (pullRequestNum) {
      releaseInfo.freshDeployment = true
      releaseInfo.extractDeployedAddresses = true
      releaseInfo.pr = true
      releaseInfo.deployNetwork = network
      releaseInfo.npmTag = `pr${pullRequestNum}`
      releaseInfo.npmPkgVersion = `1.0.0-pr.${pullRequestNum}.build.${buildNum}`
    } else {
      releaseInfo.deployNetwork = network
      releaseInfo.multisig = GNOSIS_SAFES[network]
      releaseInfo.npmTag = `latest`
      releaseInfo.npmPkgVersion = `1.0.0-build.${buildNum}`
    }

    releaseInfo.adminDappPath = releaseInfo.npmPkgVersion
  } else {
    releaseInfo.freshDeployment = true
    releaseInfo.local = true
    releaseInfo.npmTag = `local`
    releaseInfo.npmPkgVersion = `1.0.0-local.${Date.now()}`
  }
  
  releaseInfo.hash = ci.hash
  releaseInfo.date = new Date()

  fs.writeFileSync(releaseConfigFile, JSON.stringify(releaseInfo, null, 2), 'utf8')

  // update package.json
  const packageJson = require(packageJsonFile)
  packageJson.version = releaseInfo.npmPkgVersion
  fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2), 'utf8')

  // update solidity contract
  fs.writeFileSync(commonUpgradeFacetContract, `// SPDX-License-Identifier: MIT
pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/IDiamondUpgradeFacet.sol";
import "./base/IDiamondProxy.sol";

contract CommonUpgradeFacet is Controller, IDiamondUpgradeFacet {
  constructor (address _settings) Controller(_settings) public {
    // empty
  }

  function upgrade (address[] memory _facets) public override assertIsAdmin {
    IDiamondProxy(address(this)).registerFacets(_facets);
  }

  function getVersionInfo () public override pure returns (string memory num_, uint256 date_, string memory hash_) {
    num_ = "${releaseInfo.npmPkgVersion}";
    date_ = ${parseInt(releaseInfo.date.getTime() / 1000, 10)};
    hash_ = "${releaseInfo.hash}";
  }
}
`, 'utf8')

  console.log(`Release config created:

${JSON.stringify(releaseInfo, null, 2)}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

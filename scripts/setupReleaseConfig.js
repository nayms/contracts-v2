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

const isRinkeby = !!process.env.RINKEBY
const isMainnet = !!process.env.MAINNET
const pullRequestUrl = process.env.CIRCLE_PULL_REQUEST
const isForTesting = !!process.env.TEST

let pullRequestNum
if (pullRequestUrl) {
  pullRequestNum = pullRequestUrl.substr(pullRequestUrl.lastIndexOf('/') + 1)
}

const isFreshDeployment = !!pullRequestNum || process.env.FRESH
const buildNum = process.env.CIRCLE_BUILD_NUM || 'local'

async function main () {
  const ci = await new Promise((resolve, reject) => {
    git.getLastCommit(function (err, commit) {
      if (err) return reject(err)
      resolve(commit)
    })
  })

  const releaseInfo = {}

  if ((!isForTesting) && (isRinkeby || isMainnet || pullRequestNum)) {
    if (pullRequestNum) {
      releaseInfo.freshDeployment = true
      releaseInfo.extractDeployedAddresses = true
      releaseInfo.pr = true
      releaseInfo.deployRinkeby = true
      releaseInfo.npmTag = `pr${pullRequestNum}`
      releaseInfo.npmPkgVersion = `1.0.0-pr.${pullRequestNum}.build.${buildNum}`
    } else {
      releaseInfo.npmTag = `latest`
      releaseInfo.npmPkgVersion = `1.0.0-build.${buildNum}`
      releaseInfo.freshDeployment = isFreshDeployment

      if (isRinkeby) {
        releaseInfo.deployRinkeby = true
        releaseInfo.multisig = '0x52A1A89bF7C028f889Bf57D50aEB7B418c2Fc79B' // nayms rinkeby gnosis SAFE
      } else if (isMainnet) {
        releaseInfo.deployMainnet = true
        releaseInfo.multisig = '0x4e486E3838aD79acf7fb9AdD9F5519D2D0e9d79A' // nayms mainnet gnosis SAFE
      }
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
  fs.writeFileSync(commonUpgradeFacetContract, `pragma solidity >=0.6.7;

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

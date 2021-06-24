#!/usr/bin/env node

/* This script copies Maker OTC contract artifacts from git submodule into build folder */

const fse = require('fs-extra')
const path = require('path')

const projectDir = path.join(__dirname, '..')

fse.copySync(path.join(projectDir, 'node_modules', '@gnosis.pm', 'safe-contracts', 'build', 'contracts', 'GnosisSafe.json'), path.join(projectDir, 'build', 'contracts', 'GnosisSafe.json'))

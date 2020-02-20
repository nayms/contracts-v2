#!/usr/bin/env node

/* This script generates code to insert into AccessControl.sol to setup role and rolegroup constants */

const fs = require('fs')
const glob = require('glob')
const path = require('path')

const projectDir = path.join(__dirname, '..')
const { ROLES, ROLEGROUPS } = require(path.join(projectDir, 'migrations', 'utils', 'constants'))

Object.entries(ROLES).forEach(([ key, value ]) => {
  console.log(`bytes32 constant public ROLE_${key} = ${value};`)
})

Object.entries(ROLEGROUPS).forEach(([key, value]) => {
  console.log(`bytes32 constant public ROLEGROUP_${key} = ${value};`)
})

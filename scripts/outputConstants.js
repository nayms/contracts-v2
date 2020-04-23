#!/usr/bin/env node

/* This script generates code to insert into AccessControl.sol and ISettingsKeys.sol to setup constants */

const fs = require('fs')
const glob = require('glob')
const path = require('path')

const projectDir = path.join(__dirname, '..')
const { ROLES, ROLEGROUPS, SETTINGS } = require(path.join(projectDir, 'utils', 'constants'))

console.log(`\nInsert into AccessControl.sol:\n`)

Object.entries(ROLES).forEach(([ key, value ]) => {
  console.log(`bytes32 constant public ROLE_${key} = ${value};`)
})

Object.entries(ROLEGROUPS).forEach(([key, value]) => {
  console.log(`bytes32 constant public ROLEGROUP_${key} = ${value};`)
})

console.log(`\nInsert into ISettingsKeys.sol:\n`)

Object.entries(SETTINGS).forEach(([key, value]) => {
  console.log(`bytes32 constant public SETTING_${key} = ${value};`)
})

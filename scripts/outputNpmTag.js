#!/usr/bin/env node

/* This script outputs the tag to use for when publishing to NPM, based on the current package version */

const path = require('path')
const version = require(path.join(__dirname, '..', 'package.json')).version

const prStrPos = version.indexOf('pr')

if (prStrPos) {
  console.log(version.substring(prStrPos), version.lastIndexOf('-'))
} else {
  console.log('latest')
}

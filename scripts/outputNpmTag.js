#!/usr/bin/env node

/* This script outputs the tag to use for when publishing to NPM, based on the current package version */

const path = require('path')
console.log(require(path.join(__dirname, '..', 'releaseConfig.json')).npmTag)

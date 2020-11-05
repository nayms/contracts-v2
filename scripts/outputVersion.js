#!/usr/bin/env node

/* This script outputs the current package version */

const path = require('path')
console.log(require(path.join(__dirname, '..', 'package.json')).version)

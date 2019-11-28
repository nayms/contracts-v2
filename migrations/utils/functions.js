const { keccak256 } = require('js-sha3')

exports.sha3 = a => `0x${keccak256(a)}`
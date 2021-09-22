const { keccak256: sha3 } = require('js-sha3')

exports.keccak256 = a => `0x${sha3(a)}`


const web3 = require('web3')
const { keccak256 } = require('../../utils/functions')

;[
  'toBN',
  'isBN',
  'toHex',
  'toWei',
  'asciiToHex',
].forEach(m => {
  exports[m] = web3.utils[m]
})

exports.keccak256 = keccak256
const web3 = require('web3')
const { sha3 } = require('../../utils/functions')

;[
  'toBN',
  'isBN',
  'toHex',
  'toWei',
  'asciiToHex',
].forEach(m => {
  exports[m] = web3.utils[m]
})

exports.sha3 = sha3
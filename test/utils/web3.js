const web3 = require('web3')

;[
  'toBN',
  'isBN',
  'toHex',
  'toWei',
  'sha3',
  'asciiToHex',
].forEach(m => {
  exports[m] = web3.utils[m]
})

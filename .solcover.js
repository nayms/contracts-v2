const path = require('path')
const fse = require('fs-extra')

const MNEMONIC = (require('./package.json').scripts.devnet.match(/\'(.+)\'/))[1]

console.log(`Mnemonic: [ ${MNEMONIC} ]`)

const projectDir = __dirname

module.exports = {
  providerOptions: {
    total_accounts: 50,
    default_balance_ether: 1000000,
    port: 8555,
    mnemonic: MNEMONIC,
    gasLimit: '0xfffffffffff',
  },
  istanbulFolder: './coverage',
  istanbulReporter: [ 'lcov', 'html' ],
  skipFiles: [
    /* external libs */
    "base/Address.sol",
    "base/ECDSA.sol",
    "base/SafeMath.sol",
    /* testcode */,
    "test/*.sol",
    /* build-related stuff */
    "VersionInfo.sol",
    "Migrations.sol",
    "MIgrations.sol",
    /* stuff that's mostly the Diamond Standard external lib code + has assembly in it */
    "base/DiamondCutter.sol",
  ],
  onCompileComplete: () => {
    console.log('Copying over maker-otc contract artifacts...')
    fse.copySync(path.join(projectDir, 'maker-otc', 'build', 'contracts', 'MatchingMarket.json'), path.join(projectDir, '.coverage_artifacts', 'contracts', 'MatchingMarket.json'))
  }
}

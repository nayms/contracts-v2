require('@babel/register')
require('solidity-coverage')

const { TEST_MNEMONIC } = require('./utils/constants')

const mnemonic = process.env.MNEMONIC || 'notset'
const infuraKey = process.env.INFURA_KEY || process.env.INFURA_ID || 'notset'

module.exports = {
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },

  defaultNetwork: 'hardhat',

  networks: {
    hardhat: {
      blockGasLimit: 30000000,
      accounts: {
        mnemonic: TEST_MNEMONIC,
        count: 50,
      },
      mining: {
        auto: true,
      },
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${infuraKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 60000,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 60000,
    }
  },

  mocha: {
    reporter: 'spec',
    timeout: 100000,
  },
}

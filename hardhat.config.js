require('@babel/register')
require("core-js/stable")
require("regenerator-runtime/runtime")
require("@nomiclabs/hardhat-ethers")
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
      chainId: 31337,
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
      chainId: 1,
      url: `https://mainnet.infura.io/v3/${infuraKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 60000,
    },
    rinkeby: {
      chainId: 4,
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

require('@babel/register')
require("core-js/stable")
require("regenerator-runtime/runtime")
require("@nomiclabs/hardhat-ethers")
require("@nomiclabs/hardhat-truffle5")
require('solidity-coverage')

const { TEST_MNEMONIC } = require('./utils/constants')

const mnemonic = process.env.MNEMONIC || 'notset'
const alchemyKey = process.env.ALCHEMY_KEY || process.env.ALCHEMY_ID || 'notset'

module.exports = {
  solidity: {
    version: "0.8.9",
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
      initialBaseFeePerGas: 0,
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
      url: `https://eth-mainnet.alchemyapi.io/v2/${alchemyKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 120000,
    },
    rinkeby: {
      chainId: 4,
      url: `https://eth-rinkeby.alchemyapi.io/v2/${alchemyKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 120000,
      blockGasLimit: 3000000000,
      gasPrice: 8000000000,
      gasMultiplier: 1
    },
    kovan: {
      chainId: 42,
      url: `https://eth-kovan.alchemyapi.io/v2/${alchemyKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 120000,
    }
  },

  mocha: {
    reporter: 'spec',
    timeout: 100000,
  },
}


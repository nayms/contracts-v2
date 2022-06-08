require('@babel/register')
require("core-js/stable")
require("regenerator-runtime/runtime")
require("@nomiclabs/hardhat-ethers")
require("@nomiclabs/hardhat-truffle5")
require('solidity-coverage')
require("@nomiclabs/hardhat-etherscan")
require("dotenv").config()

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
        mnemonic: mnemonic,
      },
      timeout: 120000,
      gas: 10000000,
      // blockGasLimit: 3000000,
    },
    kovan: {
      chainId: 42,
      url: `https://eth-kovan.alchemyapi.io/v2/${alchemyKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 120000,
    },
    goerli: {
      chainId: 5,
      url: `https://eth-goerli.alchemyapi.io/v2/${alchemyKey}`,
      accounts: {
        mnemonic,
      },
      timeout: 120000,
    }
  },

  etherscan: {
    apiKey: {
      mainnet: `${process.env.ETHERSCAN_API_KEY}`,
      ropsten: `${process.env.ETHERSCAN_API_KEY}`,
      rinkeby: `${process.env.ETHERSCAN_API_KEY}`,
      goerli: `${process.env.ETHERSCAN_API_KEY}`,
      kovan: `${process.env.ETHERSCAN_API_KEY}`,
    },
  },

  gasReporter: {
    currency: "USD",
    gasPrice: 100,
    enabled: false,
  },

  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
    disambiguatePaths: true,
  },
  
  mocha: {
    reporter: 'spec',
    timeout: 100000,
  },
}


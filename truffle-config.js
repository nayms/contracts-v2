const mnemonic = process.env.MNEMONIC || 'notset'
const infuraKey = process.env.INFURA_KEY || 'notset'

const HDWalletProvider = require('truffle-hdwallet-provider')

const solcVersion = "0.6.7"

module.exports = {
  networks: {
    rinkeby: {
      provider: (num_addresses = 1) => new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/v3/${infuraKey}`, 0, num_addresses),
      gasPrice: 2000000000, // 2 gwei,
      network_id: 4,
      skipDryRun: true,
    },
    test: {
      host: "localhost",
      network_id: "*",
      port: 8545,
      gasPrice: 1000000000      // 1 gwei
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,
      gas: 17592186044415, // <-- Use this high gas value
      gasPrice: 0x01      // <-- Use this low gas price
    },
  },

  mocha: {
    reporter: 'spec',
    timeout: 100000,
  },

  compilers: {
    solc: {
      version: solcVersion,
      settings: {
        optimizer: {
          enabled: true
        }
      }
    }
  },

  plugins: [
    'solidity-coverage',
  ]
}

const mnemonic = process.env.MNEMONIC || 'notset'
const infuraKey = process.env.INFURA_KEY || process.env.INFURA_ID || 'notset'

const HDWalletProvider = require('@truffle/hdwallet-provider')

const solcVersion = "0.6.12"

module.exports = {
  networks: {
    mainnet: {
      provider: (num_addresses = 1) => new HDWalletProvider({
        providerOrUrl: `https://mainnet.infura.io/v3/${infuraKey}`,
        mnemonic: {
          phrase: mnemonic,
        },
        numberOfAddresses: num_addresses,
        addressIndex: 0,
        shareNonce: false,
      }),
      gasPrice: 2000000000, // 2 gwei,
      network_id: 1,
      skipDryRun: true,
    },
    rinkeby: {      
      provider: (num_addresses = 1) => new HDWalletProvider({
        providerOrUrl: `https://rinkeby.infura.io/v3/${infuraKey}`,
        mnemonic: {
          phrase: mnemonic,
        },
        numberOfAddresses: num_addresses,
        addressIndex: 0,
        shareNonce: false,
      }),
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
          enabled: true,
        }
      }
    }
  },

  plugins: [
    'solidity-coverage',
  ]
}

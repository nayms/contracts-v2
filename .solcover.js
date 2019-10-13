module.exports = {
  accounts: 10,
  port: 8545,
  compileCommand: '../node_modules/.bin/truffle compile',
  testCommand: '../node_modules/.bin/babel-node ../node_modules/.bin/truffle test --network coverage',
  skipFiles: [
    "base/Address.sol",
    "base/SafeMath.sol",
    "base/ECDSA.sol",
  ],
}

module.exports = {
  accounts: 10,
  testrpcOptions: '-p 8555 -m "funny door sample enrich female wedding stereo crane setup shop dwarf dismiss"',
  compileCommand: '../node_modules/.bin/truffle compile --network coverage && cp maker-otc/build/contracts/MatchingMarket.json build/contracts',
  testCommand: '../node_modules/.bin/babel-node ../node_modules/.bin/truffle test --network coverage',
  skipFiles: [
    "base/Address.sol",
    "base/SafeMath.sol",
    "base/ECDSA.sol",
  ],
}

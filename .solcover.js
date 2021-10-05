const spawn = require('cross-spawn')

module.exports = {
  istanbulFolder: './coverage',
  istanbulReporter: [ 'lcov', 'html' ],
  skipFiles: [
    /* external libs */
    "base/Address.sol",
    "base/ECDSA.sol",
    "base/SafeMath.sol",
    "base/ReentrancyGuard.sol",
    /* testcode */,
    "test/DummyEntityFacet.sol",
    "test/DummyPolicyFacet.sol",
    "test/EntityTreasuryTestFacet.sol",
    "test/PolicyTreasuryTestFacet.sol",
    "test/FreezeUpgradesFacet.sol",
    "test/IDummyMarketObserver.sol",
    "test/DummyMarketObserver.sol",
    /* build-related stuff */
    "VersionInfo.sol",
    "Migrations.sol",
    "MIgrations.sol",
    /* stuff that's mostly the Diamond Standard external lib code + has assembly in it */
    "base/DiamondStorageBase.sol",
    "base/DiamondCutter.sol",
  ],
  onCompileComplete: async () => {
    await spawn('yarn', ['generate-index'], { cwd: __dirname })
  }
}

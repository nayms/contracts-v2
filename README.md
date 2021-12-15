[![CircleCI](https://circleci.com/gh/nayms/contracts/tree/master.svg?style=svg)](https://circleci.com/gh/nayms/contracts/tree/master) [![Coverage Status](https://coveralls.io/repos/github/nayms/contracts/badge.svg?branch=master)](https://coveralls.io/github/nayms/contracts?branch=master)

[Nayms](https://nayms.io) Smart contracts.

_NOTE: the old version of the contracts used to deploy the v1 pilots can be found via the [v1_post_audit](https://github.com/nayms/contracts/tree/v1_post_audit) tag_.


## How to use

Install the package:

```
npm install @nayms/contracts
```

The package exposes the following properties:

* `contracts` - the key contracts (see below)
* `rawContracts` - ABIs of all Solidity contracts in the repo
* `addresses` - contents of `deployedAddresses.json`
* `events` - ABIs for events to listen for
* `releaseConfig` - the contents of `releaseConfig.json`, this is used to keep track of the build number in `VersionInfo.sol`.
* `extractEventsFromAbis()` - given an array of contract ABIs, this will extract the event ABIs within.
* `keccak256()` - keccak256 hash function
* `ROLES` - role constants
* `ROLEGROUPS` - rolegroup constants
* `SETTINGS` - settings constants

The key contracts are:

* `ACL (IACL.sol)` - Interface for our access control system. We have a single global ACL for our platform.
* `AccessControl (AccessControl.sol)` - Interface for obtaining ACL context info from deployed contracts.
* `EntityDeployer (IEntityDeployer.sol)` - Interface for the entity deployer. We have a single global deployer for our platform.
* `Entity (IEntity.sol)` - Interface for interacting with entities.
* `ERC20 (IERC20.sol)` - Interface for interacting with ERC-20 contracts.
* `EtherToken (IEtherToken.sol)` - Interface for interacting with wrapped ETH token contract. We have a single global instance for our platform.
* `Market (IMarket.sol)` - Interface for interacting with [our MakerOTC matching market](https://github.com/nayms/maker-otc). We have a single global instance for our platform.
* `Policy (IPolicy.sol)` - Interface for interacting with policies.
* `Settings (ISettings.sol)` - Interface for global settings. We have a single global settings instance for our platform.

The _Nayms company entity_ and its address can be obtained via `Settings.getAddress(SETTINGS.NAYMS_ENTITY)`.

## Technical docs

An architectural overview can be found in [docs/architecture.md](docs/architecture.md).

Architectural Decision Records (ADRs) can be found in [docs/adr](docs/adr).

## Example usage

```js
const ethers = require('ethers')
const { parseLog } = require('ethereum-event-logs')
const { contracts, addresses, events } = require('@nayms/contracts')

const mnemonic = '<mnemonic pass phrase>'

const init = async () => {
  const provider = new ethers.providers.InfuraProvider('rinkeby', '<infura token>')

  const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider)

  const deployer = new ethers.Contract(
    // '4' is Rinkeby (see https://chainid.network/chains/)
    addresses.EntityDeployer['4'].address,
    contracts.EntityDeployer.abi,
    wallet
  )

  // deploy a new Entity
  const tx = await deployer.deploy({
    gasPrice: '0x3B9ACA00', // 1,000,000,000
    gasLimit: '0x2DC6C0', // 1,500,000
  })

  console.log(`Tx hash: ${tx.hash}`)

  const receipt = await provider.waitForTransaction(tx.hash)

  const [ newEntityEvent ] = parseLog(receipt.logs, [ events.NewEntity ])
  const { args: { entity } } = newEntityEvent

  console.log(`New entity deployed at: ${entity}`)
}

init().catch(err => {
  console.error(err)
  process.exit(-1)
})
```

To deploy and use the contracts on your local chain please clone this repository and run the following deployment commands:

```shell
yarn compile
yarn deploy:local
# The addresses at which the contract are deployed will be output in the terminal.
```
## Development

**Requirements:**

* Node.js 14.16.0+
* Yarn 1.22.10+ (use `npm i -g yarn` once Node.js is installed)

Install dependencies:

```shell
yarn
```

Initialize git submodules (for maker-otc trading engine):

```shell
git submodule init
git submodule update
```

First, run the dev network in a separate terminal:

```shell
yarn devnet
```

Compile the contracts:

```shell
yarn compile
```

Setup release config:

```shell
yarn setup-release-config-for-local
```

Now deploy the contracts to it:

```shell
yarn deploy:local
```

Now you can run the tests:

```shell
yarn test
```

To run a single test:

```shell
yarn hardhat test ./test/testName.js
```

You can use the admin dapp to interact with your locally deployed contracts. 

First let's build it:

```shell
yarn build-admin-dapp
```

Then open [Metamask](https://metamask.io/) in your browser and configure it to use our [custom mnemonic](https://github.com/nayms/contracts/blob/master/package.json#L21) and pointing to `http://localhost:8545` as a _Custom RPC_ endpoint (Note: you may already have a "Localhost 8545" entry in your Metamask network list, in which ase you don't need to add a new one).

Once done, start a lightweight HTTP server to serve up the admin dapp:

```shell
npx serve ./dapp
```

Visit the URL shown in the output and enjoy.

### Deployments

_NOTE: Rinkeby/Mainnet deployments are done using Nayms wallet 2, i.e. the second wallet generated from the Nayms company mnemonic - `0xfcE918c07BD4c900941500A6632deB24bA7897Ce`. Also note that we use a dedicated Infura endpoint for smart contracts deployments (find it in 1password)_.

Set up the env vars:

```shell
export MNEMONIC="..."
export INFURA_KEY="..."
```

To upgrade existing Rinkeby contracts:

```shell
yarn setup-release-config-for-rinkeby
yarn deploy:rinkeby
```

For mainnet:

```shell
yarn setup-release-config-for-mainnet
yarn deploy:mainnet
```

By default all deployments are upgrade-only, meaning that the `ACL`, `Settings` and other such contracts won't get deployed - instead the existing addresses from `deployedAddresses.json` will be used. Existing `Entity` and `Policy` contracts will be upgraded to the latest implementations.

**Fresh deployments**

To deploy a fresh set of contracts and update `deployedAddresses.json`, edit `releaseConfig.json` and add the following keys before running the deploy command:

```shell
{
  ...
  "freshDeployment": true,
  "extractDeployedAddresses": true,
  ...
}
```

The `deployedAddresses.json` file will be modified once complete. Remember to commit this into Git and push since it contains the addresses of the newly deployed `ACL`, `Settings`, etc.

**The `release` branch**

Pushing to the `release` branch will result in a Rinkeby deployment (upgrade-only) as well as the admin dapp being deployed.

**Known issues**

When deploying to public networks, if deployment fails with a "transaction underpriced" error then it means there are pending transactions for the deployment account - you need to wait for these to complete before trying again.



## Notes

* We use `block.timestamp (now)` in the code. We assume this is safe to do since our timescales occur across days and months rather than seconds, see https://medium.com/@phillipgoldberg/smart-contract-best-practices-revisited-block-number-vs-timestamp-648905104323

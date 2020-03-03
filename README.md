[![CircleCI](https://circleci.com/gh/nayms/contracts/tree/master.svg?style=svg)](https://circleci.com/gh/nayms/contracts/tree/master) [![Coverage Status](https://coveralls.io/repos/github/nayms/contracts/badge.svg?branch=master)](https://coveralls.io/github/nayms/contracts?branch=master)

[Nayms](https://nayms.io) Smart contracts.

## General usage

Install the package:

```
npm install @nayms/contracts
```

Then you can use the contract already deployed to e.g. Rinkeby:

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

## Package contents

The package exposes the following properties:

* `contracts` - the key contracts (see below)
* `rawContracts` - ABIs of all Solidity contracts in the repo
* `addresses` - on-chain addresses of contracts in `contracts`
* `events` - ABIs for events to listen for
* `extractEventsFromAbis()` - given an array of contract ABIs, this will extract the event ABIs within.
* `ROLES` - role constants
* `ROLEGROUPS` - rolegroup constants

The key contracts are:

* `ACL (IACL.sol)` - Interface for our access control system. We have a single global ACL for our platform.
* `EntityDeployer (IEntityDeployer.sol)` - Interface for the entity deployer. We have a single global deployer for our platform.
* `Entity (IEntityImpl.sol)` - Interface for interacting with entities.
* `ERC20 (IERC20.sol)` - Interface for interacting with ERC-20 contracts.
* `EtherToken (IEtherToken.sol)` - Interface for interacting with wrapped ETH token contract. We have a single global instance for our platform.
* `Market (IMarket.sol)` - Interface for interacting with [our MakerOTC matching market](https://github.com/nayms/maker-otc). We have a single global instance for our platform.
* `Policy (IPolicyImpl.sol)` - Interface for interacting with policies.
* `Proxy (Proxy.sol)` - Interface for interacting with all upgradeable contracts (policies, entities, etc).
* `Settings (ISettingsImpl.sol)` - Interface for global settings. We have a single global settings instance for our platform.

## Development

**Note: Requires Node 12+**

Install dependencies:

```
yarn
```

Initialize git submodules (for maker-otc trading engine):

```
git submodule init
git submodule update
```

First, run the dev network in a separate terminal:

```
yarn devnet
```

Compile the contracts:

```
yarn compile
```

Now deploy the contracts to it:

```
yarn deploy:local
```

Now you can run the tests:

```
yarn test
```

### Deployments

Assuming you've followed the previous compilation step, deploy to rinkeby using:

```
MNEMONIC="..." INFURA_KEY="..." yarn deploy:rinkeby
```

## Notes

* We use `block.timestamp (now)` in the code. We assume this is safe to do since our timescales occur across days and months rather than seconds, see https://medium.com/@phillipgoldberg/smart-contract-best-practices-revisited-block-number-vs-timestamp-648905104323

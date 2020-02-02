[![CircleCI](https://circleci.com/gh/nayms/contracts/tree/master.svg?style=svg)](https://circleci.com/gh/nayms/contracts/tree/master) [![Coverage Status](https://coveralls.io/repos/github/nayms/contracts/badge.svg?branch=master)](https://coveralls.io/github/nayms/contracts?branch=master)

[Nayms](https://nayms.io) Smart contracts.

## Usage

Install the package:

```
npm install @nayms/contracts
```

Then, using [truffle-contract](https://github.com/trufflesuite/truffle/tree/develop/packages/truffle-contract) you can use the contract already deployed to e.g. Rinkeby:

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
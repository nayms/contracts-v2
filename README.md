[![CircleCI](https://circleci.com/gh/nayms/contracts/tree/master.svg?style=svg)](https://circleci.com/gh/nayms/contracts/tree/master) [![Coverage Status](https://coveralls.io/repos/github/nayms/contracts/badge.svg?branch=master)](https://coveralls.io/github/nayms/contracts?branch=master)

[Nayms](https://nayms.io) Smart contracts.

## Usage

Install the package:

```
npm install @nayms/contracts
```

Then, using [truffle-contract](https://github.com/trufflesuite/truffle/tree/develop/packages/truffle-contract) you can import and use the deployer:

```js
const promisify = require('es6-promisify')
const TruffleContract = require('truffle-contract')
const Web3 = require('web3')
const { FUCDeployer } = require('@nayms/contracts')

async init = () => {
  const web3 = new Web3(/* ... */)

  const contract = TruffleContract(FUCDeployer)
  contract.setProvider(web3.currentProvider)

  const deployer = await contract.deployed()

  // deploy a new FUC
  await deployer.deploy(/*...*/)

  const events = await promisify(deployer.contract.getPastEvents, deployer.contract)('NewFUC')

  const { returnValues: { deployedAddress } } = events.pop()

  console.log(`New contract deployed at: ${deployedAddress}`)
}
```

Using [ethereum-events-logs](https://github.com/hiddentao/ethereum-event-logs) you can
parse logs for events:

```js
// import the parser
const { parseLog } = require('ethereum-event-logs')
const { events: { NewFUC } } = require('@nayms/contracts')

const receipt = /* execute tx on chain and wait for receipt */

// we can parse all events in the contract by passing through the ABI:
const events = parseLog(receipt.logs, [ NewFUC ])

console.log(events)
/*
  [
    {
      name: 'NewFUC',
      address: '0x...',
      blockNumber: 123...,
      blockHash: '0x...',
      transactionHash: '0x...',
      ...
    },
  ]
*/
```

## Development

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

Now deploy the contracts to it:

```
yarn deploy:local
```

Now you can run the tests:

```
yarn test
```

import { EthHdWallet } from 'eth-hd-wallet'
import _ from 'lodash'
import chai from 'chai'
import { parseLog } from 'ethereum-event-logs'
import chaiAsPromised from 'chai-as-promised'

import packageJson from '../../package.json'
import { extractEventsFromAbis } from '../../'
import { toBN, isBN } from './web3'

const MNEMONIC = (packageJson.scripts.devnet.match(/\'(.+)\'/))[1]
console.log(`Mnemonic: ${MNEMONIC}`)

export const testEvents = extractEventsFromAbis([
  require('../../build/contracts/DummyERC777TokensSender.json'),
  require('../../build/contracts/DummyERC777TokensRecipient.json'),
])

chai.use((_chai, utils) => {
  const sanitizeResultVal = (result, val) => {
    // if bignumber
    if (_.get(result, 'toNumber')) {
      if (_.get(val, 'toNumber')) {
        result = result.toString(16)
        val = val.toString(16)
      }
      else if (typeof val === 'string') {
        if (val.startsWith('0x')) {
          result = result.toString(16)
        } else {
          result = result.toString(10)
        }
      }
      else if (typeof val === 'number') {
        result = result.toNumber()
      }
    }

    return [ result, val ]
  }

  utils.addMethod(_chai.Assertion.prototype, 'eq', function (val) {
    let result = utils.flag(this, 'object')

    if (result instanceof Array && val instanceof Array) {
      const newResult = []
      const newVal = []

      for (let i = 0; result.length > i || val.length > i; i += 1) {
        const [r, v] = sanitizeResultVal(result[i], val[i])
        newResult.push(r)
        newVal.push(v)
      }

      const newResultStr = newResult.join(', ')
      const newValStr = newVal.join(', ')

      return (utils.flag(this, 'negate'))
        ? new _chai.Assertion(newResultStr).to.not.be.equal(newValStr)
        : new _chai.Assertion(newResultStr).to.be.equal(newValStr)

    } else {
      const [r, v] = sanitizeResultVal(result, val)

      return (utils.flag(this, 'negate'))
        ? new _chai.Assertion(r).to.not.be.equal(v)
        : new _chai.Assertion(r).to.be.equal(v)
    }
  })
})

chai.use(chaiAsPromised)

chai.should()

export const hdWallet = EthHdWallet.fromMnemonic(MNEMONIC)
hdWallet.generateAddresses(10)

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000'


export const getBalance = async addr => toBN(await web3.eth.getBalance(addr))

// mul + div by 1000 takes care of upto 3 decimal places (since toBN() doesn't support decimals)
export const mulBN = (bn, factor) => bn.mul( toBN(factor * 1000) ).div( toBN(1000) )

export const parseEvents = (result, e) => {
  return parseLog(result.receipt.rawLogs, [ e ])
}

export const extractEventArgs = (result, eventAbi) => {
  const { args } = parseEvents(result, eventAbi).pop()

  for (let key in args) {
    if (isBN(args[key])) {
      args[key] = args[key].toString(10)
    }
  }

  return args
}

export const outputBNs = bn => {
  console.log('BNs: ');
  Object.keys(bn).forEach(k => {
    console.log(`   ${bn[k].toString(10)} => ${bn[k].toString(2)}`)
  })
}

export const createTranch = (policy, attrs, ...callAttrs) => {
  const {
    numShares = 10,
    pricePerShareAmount = 1,
    premiums = [],
    initialBalanceHolder = ADDRESS_ZERO,
  } = attrs

  return policy.createTranch(
    numShares,
    pricePerShareAmount,
    premiums,
    initialBalanceHolder,
    ...callAttrs,
  )
}

export const createPolicy = (entity, policyImpl, attrs, ...callAttrs) => {
  const currentTime = ~~(Date.now() / 1000)

  const {
    initiationDate = currentTime,
    startDate = currentTime + 120,
    maturationDate = currentTime + 300,
    unit = ADDRESS_ZERO,
    premiumIntervalSeconds = 30,
  } = attrs

  return entity.createPolicy(
    policyImpl,
    initiationDate,
    startDate,
    maturationDate,
    unit,
    premiumIntervalSeconds,
    ...callAttrs,
  )
}

export const web3EvmIncreaseTime = (web3, ts) => {
  return new Promise((resolve, reject) => {
    return web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [ts],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}
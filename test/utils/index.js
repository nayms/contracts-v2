import { EthHdWallet } from 'eth-hd-wallet'
import _ from 'lodash'
import chai from 'chai'
import { parseLog } from 'ethereum-event-logs'
import chaiAsPromised from 'chai-as-promised'

import packageJson from '../../package.json'
import { extractEventsFromAbis } from '../../'
import { toBN, isBN } from './web3'

const MNEMONIC = (packageJson.scripts.devnet.match(/\'(.+)\'/))[1]
console.log(`Mnemonic: [ ${MNEMONIC} ]`)

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

  utils.addMethod(_chai.Assertion.prototype, 'matchObj', function (val) {
    let result = utils.flag(this, 'object')

    if (result instanceof Object) {
      const newResult = {}
      const newVal = {}

      Object.keys(result).forEach(i => {
        const [r, v] = sanitizeResultVal(result[i], val[i])
        if (typeof r !== 'undefined') {
          newResult[i] = r
        }
        if (typeof v !== 'undefined') {
          newVal[i] = v
        }
      })

      return (utils.flag(this, 'negate'))
        ? new _chai.Assertion(newResult).to.not.contain(newVal)
        : new _chai.Assertion(newResult).to.contain(newVal)

    } else {
      throw new Error('Not an object', result)
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
  const { args } = parseEvents(result, eventAbi).pop() || {}

  if (!args) {
    return null
  }

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

export const createPolicy = (entity, attrs, ...callAttrs) => {
  const currentTime = ~~(Date.now() / 1000)

  const {
    initiationDate = currentTime,
    startDate = currentTime + 120,
    maturationDate = currentTime + 300,
    unit = ADDRESS_ZERO,
    premiumIntervalSeconds = 30,
    brokerCommissionBP = 0,
    capitalProviderCommissionBP = 0,
    naymsCommissionBP = 0
  } = attrs

  return entity.createPolicy(
    [initiationDate, startDate, maturationDate],
    unit,
    premiumIntervalSeconds,
    [brokerCommissionBP, capitalProviderCommissionBP, naymsCommissionBP],
    ...callAttrs,
  )
}


export const preSetupPolicy = async (ctx, createPolicyArgs) => {
  const {
    initiationDateDiff,
    startDateDiff,
    maturationDateDiff,
    premiumIntervalSeconds,
    brokerCommissionBP,
    capitalProviderCommissionBP,
    naymsCommissionBP,
  } = (createPolicyArgs || {})

  // get current evm time
  const t = await ctx.settings.getTime()
  const currentBlockTime = parseInt(t.toString(10))

  const attrs = {
    initiationDate: currentBlockTime + initiationDateDiff,
    startDate: currentBlockTime + startDateDiff,
    maturationDate: currentBlockTime + maturationDateDiff,
    unit: ctx.etherToken.address,
    premiumIntervalSeconds,
    brokerCommissionBP,
    capitalProviderCommissionBP,
    naymsCommissionBP,
  }

  const createPolicyTx = await createPolicy(ctx.entity, attrs, { from: ctx.entityManagerAddress })
  const policyAddress = extractEventArgs(createPolicyTx, ctx.events.NewPolicy).policy

  ctx.policies.set(createPolicyArgs, { attrs, baseTime: currentBlockTime, policyAddress })
}

export const calcPremiumsMinusCommissions = ({ premiums, capitalProviderCommissionBP, brokerCommissionBP, naymsCommissionBP }) => (
  premiums.reduce((m, v) => (
    m + v - (v * capitalProviderCommissionBP / 1000) - (v * brokerCommissionBP / 1000) - (v * naymsCommissionBP / 1000)
  ), 0)
)


export const calcCommissions = ({ premiums, capitalProviderCommissionBP, brokerCommissionBP, naymsCommissionBP }) => {
  const ret = {
    capitalProviderCommission: 0,
    brokerCommission: 0,
    naymsCommission: 0,
  }

  premiums.forEach(v => {
    ret.capitalProviderCommission += (v * capitalProviderCommissionBP / 1000)
    ret.brokerCommission += (v * brokerCommissionBP / 1000)
    ret.naymsCommission += (v * naymsCommissionBP / 1000)
  })

  return ret
}

const callJsonRpcMethod = async (method, params = []) => {
  return new Promise((resolve, reject) => {
    return web3.currentProvider.send({
      jsonrpc: '2.0',
      method,
      params,
      id: new Date().getTime()
    }, (err, { result }) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

const web3EvmIncreaseTime = async ts => {
  await callJsonRpcMethod('evm_increaseTime', [ ts ])
  await callJsonRpcMethod('evm_mine')
}


export class EvmClock {
  constructor (initialTimestamp = 0) {
    this.originalTimestamp = initialTimestamp
    this.lastTimestamp = initialTimestamp
  }

  async setAbsoluteTime (timestamp) {
    if (timestamp <= this.lastTimestamp) {
      throw new Error(`Cannot set to past time: ${timestamp}`)
    }
    await web3EvmIncreaseTime(timestamp - this.lastTimestamp)
    this.lastTimestamp = timestamp
  }

  async setRelativeTime(relativeTimestamp) {
    const timestamp = relativeTimestamp + this.originalTimestamp
    if (timestamp <= this.lastTimestamp) {
      throw new Error(`Cannot set to past time: ${timestamp}`)
    }
    await web3EvmIncreaseTime(timestamp - this.lastTimestamp)
    this.lastTimestamp = timestamp
  }

  async moveTime (delta) {
    if (0 >= delta) {
      throw new Error(`Cannot move into the past: ${delta}`)
    }
    await web3EvmIncreaseTime(delta)
    this.lastTimestamp = this.lastTimestamp + delta
  }
}


export class EvmSnapshot {
  constructor () {
    this._ids = []
  }

  async take () {
    this._ids.push(await callJsonRpcMethod('evm_snapshot'))
  }

  async restore () {
    if (!this._ids.length) {
      throw new Error('No more snapshots to revert to')
    }

    await callJsonRpcMethod('evm_revert', [ this._ids.pop() ])
  }
}



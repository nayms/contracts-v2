import { EthHdWallet } from 'eth-hd-wallet'
import _ from 'lodash'
import chai from 'chai'
import { parseLog } from 'ethereum-event-logs'
import chaiAsPromised from 'chai-as-promised'
import uuid from 'uuid/v4'

import { events } from '../..'
import { toBN, isBN } from './web3'
import { ADDRESS_ZERO, BYTES32_ZERO, BYTES_ZERO } from '../../utils/constants'
import { ROLES, TEST_MNEMONIC } from '../../utils/constants'
import { keccak256 } from '../../utils/functions'
import { getAccountWallet } from '../../deploy/utils'

export { ADDRESS_ZERO, BYTES32_ZERO, BYTES_ZERO }

export { keccak256, uuid }

export { expect } from 'chai'

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

    return [result, val]
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

export const hdWallet = EthHdWallet.fromMnemonic(TEST_MNEMONIC)
hdWallet.generateAddresses(10)

export const getBalance = async addr => toBN(await web3.eth.getBalance(addr))

// mul + div by 1000 takes care of upto 3 decimal places (since toBN() doesn't support decimals)
export const mulBN = (bn, factor) => bn.mul(toBN(factor * 1000)).div(toBN(1000))

export const parseEvents = (result, e) => {
  return parseLog(result.receipt.rawLogs, [e])
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

export const createTranche = async (policy, attrs, ...callAttrs) => {
  const {
    numShares = 10,
    pricePerShareAmount = 1,
    premiumsDiff = [],
  } = attrs

  let premiums = []
  let policyInfo 
  policyInfo = await policy.getInfo()
  const policyInitiationDate = policyInfo.initiationDate_.toNumber()

  premiums = adjustTrancheDataDiffForSingleTranche(policyInitiationDate, premiumsDiff, false)

  return policy.createTranche(
    numShares,
    pricePerShareAmount,
    premiums,
    ...callAttrs,
  )
}

const adjustTrancheDataDiffForSingleTranche = (policyInitiationDate, trancheDiffData, forTrancheData) => {
  // this processes the single dimension array for createTranche()
  // as well as the inner portion of the array for createPolicy()

  let trancheData = trancheDiffData
  let startAt = 0

  // trancheData includes two extra fields at the beginning
  if (forTrancheData){
    startAt = 2
  }
  if ((trancheDiffData != undefined) && (trancheDiffData.length > 0 )){
    for (let j = startAt; j < trancheDiffData.length; j += 2) {
      trancheData[j] = policyInitiationDate + trancheDiffData[j]
    }
  }
  else {
    trancheData = []
  }
  return trancheData
}

const adjustTrancheDataDiff = (policyInitiationDate, trancheDiffData) => {
  //this processes the full two-dimension array for create policy
  let trancheData = trancheDiffData

  if ((trancheDiffData != undefined) && (trancheDiffData.length > 0 )){
      for (let i = 0; i < trancheDiffData.length; i += 1) {
      trancheData[i] = adjustTrancheDataDiffForSingleTranche(policyInitiationDate, trancheData[i], true)
    }
  }
  else {
    trancheData = []
  }

  return trancheData
}

export const createEntity = async ({ acl, entityDeployer, adminAddress, entityContext = BYTES32_ZERO }) => {
  const deployEntityTx = await entityDeployer.deploy(adminAddress, entityContext)
  const { entity: entityAddress } = extractEventArgs(deployEntityTx, events.NewEntity)
  if (entityContext != BYTES32_ZERO) {
    await acl.assignRole(entityContext, adminAddress, ROLES.ENTITY_ADMIN)
  }
  return entityAddress
}

export const createPolicy = async (entity, attrs = {}, ...callAttrs) => {
  const currentTime = ~~(Date.now() / 1000)
  var ret = '';

  const {
    policyId = keccak256(uuid()),
    type = 0,
    treasury = entity.address,
    initiationDate = currentTime,
    startDate = currentTime + 120,
    maturationDate = currentTime + 300,
    unit = ADDRESS_ZERO,

    brokerCommissionBP = 0,
    claimsAdminCommissionBP = 0,
    naymsCommissionBP = 0,
    underwriterCommissionBP = 0,

    broker = ADDRESS_ZERO,
    underwriter = entity.address,
    claimsAdmin = ADDRESS_ZERO,
    insuredParty = ADDRESS_ZERO,
    trancheData = [],
    approvalSignatures = [],
  } = attrs

  return entity.createPolicy(
    policyId,
    [
      type, 
      initiationDate, startDate, maturationDate, 
      brokerCommissionBP, underwriterCommissionBP, claimsAdminCommissionBP, naymsCommissionBP,
    ],
    [
      unit,
      treasury,
      broker, underwriter, claimsAdmin, insuredParty,
    ],
    trancheData,
    approvalSignatures,
    ...callAttrs,
  )
}

export const preSetupPolicy = async (ctx, createPolicyArgs) => {
  const {
    policyId,
    type,
    initiationDateDiff,
    startDateDiff,
    maturationDateDiff,
    premiumIntervalSeconds,
    brokerCommissionBP,
    claimsAdminCommissionBP,
    naymsCommissionBP,
    underwriterCommissionBP,
    broker,
    underwriter,
    claimsAdmin,
    insuredParty,
    trancheDataDiff
  } = (createPolicyArgs || {})

  // get current evm time
  const t = await ctx.settings.getTime()
  const currentBlockTime = parseInt(t.toString(10))

  const attrs = {
    policyId,
    type,
    initiationDate: currentBlockTime + initiationDateDiff,
    startDate: currentBlockTime + startDateDiff,
    maturationDate: currentBlockTime + maturationDateDiff,
    unit: ctx.etherToken.address,
    brokerCommissionBP,
    claimsAdminCommissionBP,
    naymsCommissionBP,
    underwriterCommissionBP,
    broker,
    underwriter,
    claimsAdmin,
    insuredParty,
    trancheData: adjustTrancheDataDiff(currentBlockTime + initiationDateDiff, trancheDataDiff)
  }

  var createPolicyTx
  var policyAddress

  createPolicyTx = await createPolicy(ctx.entity, attrs, { from: ctx.entityManagerAddress })
  policyAddress = extractEventArgs(createPolicyTx, ctx.events.NewPolicy).policy

  ctx.policies.set(createPolicyArgs, { attrs, baseTime: currentBlockTime, policyAddress })
}

export const doPolicyApproval = async ({ policy, underwriterRep, insuredPartyRep, brokerRep, claimsAdminRep }) => {
  await policy.approve(ROLES.PENDING_UNDERWRITER, { from: underwriterRep })
  await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })
  await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
  await policy.approve(ROLES.PENDING_CLAIMS_ADMIN, { from: claimsAdminRep })
}

export const generateApprovalSignatures = async ({ policyId, brokerRep, underwriterRep, claimsAdminRep, insuredPartyRep }) => {
  // need to convert hash to bytes first (see https://docs.ethers.io/v5/api/signer/#Signer-signMessage)
  const bytes = hre.ethers.utils.arrayify(policyId)
  return {
    broker: await getAccountWallet(brokerRep).signMessage(bytes),
    underwriter: await getAccountWallet(underwriterRep).signMessage(bytes),
    claimsAdmin: await getAccountWallet(claimsAdminRep).signMessage(bytes),
    insuredParty: await getAccountWallet(insuredPartyRep).signMessage(bytes),
  }
}

export const calcPremiumsMinusCommissions = ({ premiums, claimsAdminCommissionBP, brokerCommissionBP, naymsCommissionBP, underwriterCommissionBP }) => (
  premiums.reduce((m, v) => (
    m + v - (v * claimsAdminCommissionBP / 10000) - (v * brokerCommissionBP / 10000) - (v * naymsCommissionBP / 10000) - (v * underwriterCommissionBP / 10000)
  ), 0)
)


export const calcCommissions = ({ premiums, claimsAdminCommissionBP, brokerCommissionBP, naymsCommissionBP, underwriterCommissionBP }) => {
  const ret = {
    claimsAdminCommission: 0,
    brokerCommission: 0,
    naymsCommission: 0,
    underwriterCommissionBP: 0,
  }

  premiums.forEach(v => {
    ret.claimsAdminCommission += (v * claimsAdminCommissionBP / 1000)
    ret.brokerCommission += (v * brokerCommissionBP / 1000)
    ret.naymsCommission += (v * naymsCommissionBP / 1000)
    ret.underwriterCommission += (v * underwriterCommissionBP / 1000)
  })

  return ret
}

const callJsonRpcMethod = async (method, params = []) => hre.network.provider.send(method, params)

const web3EvmIncreaseTime = async ts => {
  await callJsonRpcMethod('evm_increaseTime', [ts])
  await callJsonRpcMethod('evm_mine')
}

export class EvmClock {
  constructor(initialTimestamp = 0) {
    this.originalTimestamp = initialTimestamp
    this.lastTimestamp = initialTimestamp
  }

  async setAbsoluteTime(timestamp) {
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

  async moveTime(delta) {
    if (0 >= delta) {
      throw new Error(`Cannot move into the past: ${delta}`)
    }
    await web3EvmIncreaseTime(delta)
    this.lastTimestamp = this.lastTimestamp + delta
  }
}


export class EvmSnapshot {
  constructor() {
    this._ids = []
  }

  async take() {
    this._ids.push(await callJsonRpcMethod('evm_snapshot'))
  }

  async restore() {
    if (!this._ids.length) {
      throw new Error('No more snapshots to revert to')
    }

    await callJsonRpcMethod('evm_revert', [this._ids.pop()])
  }
}

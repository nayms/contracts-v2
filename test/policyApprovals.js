import {
  extractEventArgs,
  parseEvents,
  createTranch,
  createPolicy,
  EvmClock,
  calcPremiumsMinusCommissions,
  EvmSnapshot,
} from './utils'

import { events } from '..'
import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ROLES, ROLEGROUPS } from '../utils/constants'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./IPolicy")
const IERC20 = artifacts.require("./base/IERC20")

contract('Policy: Approvals', accounts => {
  const evmSnapshot = new EvmSnapshot()

  const capitalProviderCommissionBP = 100
  const brokerCommissionBP = 200
  const naymsCommissionBP = 300

  let acl
  let systemContext
  let settings
  let entityDeployer
  let policyProxy
  let policy
  let entity
  let premiumIntervalSeconds
  let baseDate
  let initiationDate
  let startDate
  let maturationDate
  let market
  let etherToken
  let entityManagerAddress
  let policyOwnerAddress

  let insuredParty
  let capitalProvider
  let broker

  let POLICY_STATE_CREATED
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let POLICY_STATE_IN_APPROVAL
  let POLICY_STATE_APPROVED
  let POLICY_STATE_CANCELLED
  
  let TRANCH_STATE_CREATED
  let TRANCH_STATE_SELLING
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED
  let TRANCH_STATE_CANCELLED

  let getTranchToken

  let evmClock

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts, settings })

    // entity
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings, entityDeployer })

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    const entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    const entityContext = await entityProxy.aclContext()

    // entity manager
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[1]

    const [ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts, settings })

    // get current evm time
    baseDate = parseInt((await settings.getTime()).toString(10))

    // roles
    capitalProvider = accounts[5]
    insuredParty = accounts[6]
    broker = accounts[7]
    await acl.assignRole(entityContext, insuredParty, ROLES.ENTITY_REP)

    // initiation time is 20 seconds from now
    initiationDate = baseDate + 1000
    startDate = initiationDate + 1000
    maturationDate = startDate + 2000
    premiumIntervalSeconds = 500

    const createPolicyTx = await createPolicy(entity, {
      initiationDate,
      startDate,
      maturationDate,
      premiumIntervalSeconds,
      unit: etherToken.address,
      capitalProviderCommissionBP,
      brokerCommissionBP,
      naymsCommissionBP,
      capitalProvider,
      insuredParty,
      broker,
    }, { from: entityManagerAddress })
    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy
    policyOwnerAddress = entityManagerAddress

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicy.at(policyAddress)
    const policyContext = await policyProxy.aclContext()

    // get market address
    market = await ensureMarketIsDeployed({ artifacts, settings })

    // setup two tranches
    await createTranch(policy, {
      numShares: 100,
      pricePerShareAmount: 2,
      premiums: [10, 20, 30, 40, 50, 60, 70],
    }, { from: policyOwnerAddress })

    await createTranch(policy, {
      numShares: 50,
      pricePerShareAmount: 2,
      premiums: [10, 20, 30, 40, 50, 60, 70],
    }, { from: policyOwnerAddress })

    getTranchToken = async idx => {
      const { token_: tt } = await policy.getTranchInfo(idx)
      return await IERC20.at(tt)
    }

    const policyStates = await IPolicyStates.at(policyCoreAddress)

    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_CANCELLED = await policyStates.POLICY_STATE_CANCELLED()
    POLICY_STATE_IN_APPROVAL = await policyStates.POLICY_STATE_IN_APPROVAL()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()

    TRANCH_STATE_CREATED = await policyStates.TRANCH_STATE_CREATED()
    TRANCH_STATE_SELLING = await policyStates.TRANCH_STATE_SELLING()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
    evmClock = new EvmClock(baseDate)
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('policy can be approved', () => {
    beforeEach(async () => {
      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_CREATED
      })
    })

    it('by capital provider', async () => {
      await policy.approve({ from: capitalProvider })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        capitalProviderApproved_: true,
        brokerApproved_: false,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('and approvals are idempotent', async () => {
      await policy.approve({ from: capitalProvider })
      await policy.approve({ from: capitalProvider })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        capitalProviderApproved_: true,
        brokerApproved_: false,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('and approvals emit an event', async () => {
      const result = await policy.approve({ from: capitalProvider })

      const ev = extractEventArgs(result, events.Approved)
      expect(ev.caller).to.eq(capitalProvider)
      expect(ev.role).to.eq(ROLES.CAPITAL_PROVIDER)
    })

    it('by broker', async () => {
      await policy.approve({ from: broker })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        capitalProviderApproved_: false,
        brokerApproved_: true,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('by insured party', async () => {
      await policy.approve({ from: insuredParty })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: true,
        capitalProviderApproved_: false,
        brokerApproved_: false,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('by everyone and this then initiates it', async () => {
      await policy.approve({ from: insuredParty })
      await policy.approve({ from: capitalProvider })
      await policy.approve({ from: broker })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: true,
        insuredPartyApproved_: true,
        capitalProviderApproved_: true,
        brokerApproved_: true,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_APPROVED
      })
    })
  })
})

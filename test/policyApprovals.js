import {
  extractEventArgs,
  parseEvents,
  createTranch,
  createPolicy,
  EvmClock,
  calcPremiumsMinusCommissions,
  EvmSnapshot,
  createEntity,
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

  const underwriterCommissionBP = 100
  const brokerCommissionBP = 200
  const naymsCommissionBP = 300

  let acl
  let systemContext
  let settings
  let entityDeployer
  let policyProxy
  let policy
  let policyContext
  let entity
  let premiumIntervalSeconds
  let baseDate
  let initiationDate
  let startDate
  let maturationDate
  let market
  let etherToken

  const entityAdminAddress = accounts[0]
  const entityManagerAddress = accounts[1]
  const insuredPartyRep = accounts[4]
  const underwriterRep = accounts[5]
  const brokerRep = accounts[6]
  const claimsAdminRep = accounts[7]

  let policyOwnerAddress

  let insuredParty
  let underwriter
  let broker
  let claimsAdmin

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

    const entityAddress = await createEntity(entityDeployer, entityAdminAddress)
    const entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    const entityContext = await entityProxy.aclContext()

    // entity manager
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER, { from: entityAdminAddress })
    
    const [ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts, settings })

    // get current evm time
    baseDate = parseInt((await settings.getTime()).toString(10))

    // roles
    underwriter = await createEntity(entityDeployer, underwriterRep)
    insuredParty = await createEntity(entityDeployer, insuredPartyRep)
    broker = await createEntity(entityDeployer, brokerRep)
    claimsAdmin = await createEntity(entityDeployer, claimsAdminRep)

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
      underwriterCommissionBP,
      brokerCommissionBP,
      naymsCommissionBP,
      underwriter,
      insuredParty,
      broker,
      claimsAdmin,
    }, { from: entityManagerAddress })
    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy
    policyOwnerAddress = entityManagerAddress

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicy.at(policyAddress)
    policyContext = await policyProxy.aclContext()

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

  it('has default roles set', async () => {
    await acl.getUsersForRole(policyContext, ROLES.PENDING_UNDERWRITER).should.eventually.eql([ underwriter ])
    await acl.getUsersForRole(policyContext, ROLES.UNDERWRITER).should.eventually.eql([])

    await acl.getUsersForRole(policyContext, ROLES.PENDING_BROKER).should.eventually.eql([ broker ])
    await acl.getUsersForRole(policyContext, ROLES.BROKER).should.eventually.eql([])

    await acl.getUsersForRole(policyContext, ROLES.PENDING_INSURED_PARTY).should.eventually.eql([ insuredParty ])
    await acl.getUsersForRole(policyContext, ROLES.INSURED_PARTY).should.eventually.eql([])

    await acl.getUsersForRole(policyContext, ROLES.PENDING_CLAIMS_ADMIN).should.eventually.eql([ claimsAdmin ])
    await acl.getUsersForRole(policyContext, ROLES.CLAIMS_ADMIN).should.eventually.eql([])
  })

  describe('policy can be approved', () => {
    beforeEach(async () => {
      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_CREATED
      })
    })

    it('but caller entity role must match', async () => {
      await policy.approve(ROLES.PENDING_UNDERWRITER, { from: brokerRep }).should.be.rejected
    })

    it('by underwriter', async () => {
      await policy.approve(ROLES.PENDING_UNDERWRITER, { from: underwriterRep })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        underwriterApproved_: true,
        brokerApproved_: false,
        claimsAdminApproved_: false,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('and role gets flipped', async () => {
      await policy.approve(ROLES.PENDING_UNDERWRITER, { from: underwriterRep })

      await acl.getUsersForRole(policyContext, ROLES.PENDING_UNDERWRITER).should.eventually.eql([])
      await acl.getUsersForRole(policyContext, ROLES.UNDERWRITER).should.eventually.eql([underwriter])
    })

    it('and approvals are not idempotent', async () => {
      await policy.approve(ROLES.PENDING_UNDERWRITER, { from: underwriterRep })
      await policy.approve(ROLES.PENDING_UNDERWRITER, { from: underwriterRep }).should.be.rejectedWith('no entity with role')
    })

    it('and approvals emit an event', async () => {
      const result = await policy.approve(ROLES.PENDING_UNDERWRITER, { from: underwriterRep })

      const ev = extractEventArgs(result, events.Approved)
      expect(ev.caller).to.eq(underwriterRep)
      expect(ev.role).to.eq(ROLES.UNDERWRITER)
    })

    it('by broker', async () => {
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        underwriterApproved_: false,
        brokerApproved_: true,
        claimsAdminApproved_: false,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('by insured party', async () => {
      await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: true,
        underwriterApproved_: false,
        brokerApproved_: false,
        claimsAdminApproved_: false,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('by claims admin', async () => {
      await policy.approve(ROLES.PENDING_CLAIMS_ADMIN, { from: claimsAdminRep })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        underwriterApproved_: false,
        brokerApproved_: false,
        claimsAdminApproved_: true,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('by everyone and this then initiates it', async () => {
      await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })
      await policy.approve(ROLES.PENDING_UNDERWRITER, { from: underwriterRep })
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
      await policy.approve(ROLES.PENDING_CLAIMS_ADMIN, { from: claimsAdminRep })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: true,
        insuredPartyApproved_: true,
        underwriterApproved_: true,
        brokerApproved_: true,
        claimsAdminApproved_: true,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_APPROVED
      })

      await acl.getUsersForRole(policyContext, ROLES.PENDING_UNDERWRITER).should.eventually.eql([])
      await acl.getUsersForRole(policyContext, ROLES.UNDERWRITER).should.eventually.eql([underwriter])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_BROKER).should.eventually.eql([])
      await acl.getUsersForRole(policyContext, ROLES.BROKER).should.eventually.eql([broker])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_INSURED_PARTY).should.eventually.eql([])
      await acl.getUsersForRole(policyContext, ROLES.INSURED_PARTY).should.eventually.eql([insuredParty])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_CLAIMS_ADMIN).should.eventually.eql([])
      await acl.getUsersForRole(policyContext, ROLES.CLAIMS_ADMIN).should.eventually.eql([claimsAdmin])
    })
  })
})

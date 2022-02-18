import {
  uuid,
  extractEventArgs,
  parseEvents,
  createTranche,
  createPolicy,
  doPolicyApproval,
  generateApprovalSignatures,
  EvmClock,
  EvmSnapshot,
  createEntity,
  keccak256,
} from './utils'

import { getAccounts, getAccountWallet } from '../deploy/utils'
import { events } from '..'
import { ROLES } from '../utils/constants'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureMarketIsDeployed } from '../deploy/modules/market'
import { ensureEntityDeployerIsDeployed } from '../deploy/modules/entityDeployer'
import { ensureEntityImplementationsAreDeployed } from '../deploy/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../deploy/modules/policyImplementations'

const IEntity = artifacts.require('base/IEntity')
const Entity = artifacts.require('Entity')
const IPolicyStates = artifacts.require("base/IPolicyStates")
const Policy = artifacts.require("Policy")
const IPolicy = artifacts.require("IPolicy")
const DummyToken = artifacts.require("DummyToken")
const IERC20 = artifacts.require("base/IERC20")

describe('Policy: Approvals', () => {
  const evmSnapshot = new EvmSnapshot()

  const claimsAdminCommissionBP = 100
  const brokerCommissionBP = 200
  const naymsCommissionBP = 300

  let accounts
  let acl
  let systemContext
  let settings
  let entityDeployer
  let policyProxy
  let policy
  let policyContext
  let entity
  let baseDate
  let initiationDate
  let startDate
  let maturationDate
  let market
  let etherToken
  let policyOwnerAddress

  let entityAdminAddress
  let entityManagerAddress
  let insuredPartyRep
  let underwriterRep
  let brokerRep
  let claimsAdminRep

  let insuredParty
  let underwriter
  let broker
  let claimsAdmin

  let POLICY_STATE_CREATED
  let POLICY_STATE_IN_APPROVAL
  let POLICY_STATE_APPROVED
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let POLICY_STATE_CANCELLED

  let policyId

  before(async () => {
    accounts = await getAccounts()
    entityAdminAddress = accounts[0]
    entityManagerAddress = accounts[1]
    insuredPartyRep = accounts[4]
    underwriterRep = accounts[5]
    brokerRep = accounts[6]
    claimsAdminRep = accounts[7]

    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // wrappedEth
    etherToken = await DummyToken.new('Token 1', 'TOK1', 18, 0, false)

    // entity
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings, entityDeployer })

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)

    const entityAddress = await createEntity({ entityDeployer, adminAddress: entityAdminAddress })
    const entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    const entityContext = await entityProxy.aclContext()
    
    // entity manager
    await acl.assignRole(systemContext, entityManagerAddress, ROLES.APPROVED_USER)
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER, { from: entityAdminAddress })
    
    const { facets: [ policyCoreAddress ] } = await ensurePolicyImplementationsAreDeployed({ artifacts, settings })

    // get current evm time
    baseDate = parseInt((await settings.getTime()).toString(10))

    // roles
    underwriter = await createEntity({ entityDeployer, adminAddress: underwriterRep, entityContext, acl })
    insuredParty = await createEntity({ entityDeployer, adminAddress: insuredPartyRep })
    broker = await createEntity({ entityDeployer, adminAddress: brokerRep })
    claimsAdmin = await createEntity({ entityDeployer, adminAddress: claimsAdminRep })

    // initiation time is 20 seconds from now
    initiationDate = baseDate + 1000
    startDate = initiationDate + 1000
    maturationDate = startDate + 2000
    const trancheData = 
    [[100, 2, 
      initiationDate + 0, 10 ,
      initiationDate + 500 , 20,
      initiationDate + 1000, 30,
      initiationDate + 1500, 40,
      initiationDate + 2000, 50,
      initiationDate + 2500, 60,
      initiationDate + 3000, 70 ]]

    policyId = keccak256(uuid())

    await entity.updateAllowPolicy(true)

    const createPolicyTx = await createPolicy(entity, {
      policyId,
      initiationDate,
      startDate,
      maturationDate,
      unit: etherToken.address,
      claimsAdminCommissionBP,
      brokerCommissionBP,
      naymsCommissionBP,
      underwriter,
      insuredParty,
      broker,
      claimsAdmin,
      trancheData
    }, { from: entityManagerAddress })

    await entity.updateAllowPolicy(false)

    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy
    policyOwnerAddress = entityManagerAddress

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicy.at(policyAddress)
    policyContext = await policyProxy.aclContext()

    // get market address
    market = await ensureMarketIsDeployed({ artifacts, settings })

    // setup second tranche. First one was set in the createPolicy call
    await createTranche(policy, {
      numShares: 50,
      pricePerShareAmount: 2,
      premiumsDiff: [0, 10 ,500 , 20, 1000, 30, 1500, 40, 2000, 50, 2500, 60, 3000, 70 ]
    }, { from: policyOwnerAddress })

    const policyStates = await IPolicyStates.at(policyCoreAddress)

    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_CANCELLED = await policyStates.POLICY_STATE_CANCELLED()
    POLICY_STATE_IN_APPROVAL = await policyStates.POLICY_STATE_IN_APPROVAL()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('has default roles set and is pre-approved by creator', () => {
    it('when created by underwriter', async () => {
      await acl.getUsersForRole(policyContext, ROLES.UNDERWRITER).should.eventually.eql([underwriter])
      await acl.getUsersForRole(policyContext, ROLES.PENDING_UNDERWRITER).should.eventually.eql([underwriter])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_BROKER).should.eventually.eql([broker])
      await acl.getUsersForRole(policyContext, ROLES.BROKER).should.eventually.eql([])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_INSURED_PARTY).should.eventually.eql([insuredParty])
      await acl.getUsersForRole(policyContext, ROLES.INSURED_PARTY).should.eventually.eql([])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_CLAIMS_ADMIN).should.eventually.eql([claimsAdmin])
      await acl.getUsersForRole(policyContext, ROLES.CLAIMS_ADMIN).should.eventually.eql([])

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        underwriterApproved_: true,
        brokerApproved_: false,
        claimsAdminApproved_: false,
      })
    })

    it('when created by broker', async () => {

      await entity.updateAllowPolicy(true)

      const tx = await createPolicy(entity, {
        initiationDate,
        startDate,
        maturationDate,
        unit: etherToken.address,
        claimsAdminCommissionBP,
        brokerCommissionBP,
        naymsCommissionBP,
        underwriter,
        insuredParty,
        broker,
        claimsAdmin,
      }, { from: brokerRep }).should.eventually.be.fulfilled

      await entity.updateAllowPolicy(false)

      const addr = extractEventArgs(tx, events.NewPolicy).policy
      const pol = await IPolicy.at(addr)
      const ctx = await pol.aclContext()

      await acl.getUsersForRole(ctx, ROLES.BROKER).should.eventually.eql([broker])
      await acl.getUsersForRole(ctx, ROLES.PENDING_BROKER).should.eventually.eql([broker])

      await acl.getUsersForRole(ctx, ROLES.UNDERWRITER).should.eventually.eql([])
      await acl.getUsersForRole(ctx, ROLES.PENDING_UNDERWRITER).should.eventually.eql([underwriter])

      await acl.getUsersForRole(ctx, ROLES.PENDING_INSURED_PARTY).should.eventually.eql([insuredParty])
      await acl.getUsersForRole(ctx, ROLES.INSURED_PARTY).should.eventually.eql([])

      await acl.getUsersForRole(ctx, ROLES.PENDING_CLAIMS_ADMIN).should.eventually.eql([claimsAdmin])
      await acl.getUsersForRole(ctx, ROLES.CLAIMS_ADMIN).should.eventually.eql([])

      await pol.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        underwriterApproved_: false,
        brokerApproved_: true,
        claimsAdminApproved_: false,
      })
    })
  })

  describe('policy can be approved by one stakeholder at a time', () => {
    it('but caller entity role must match', async () => {
      await policy.approve(ROLES.PENDING_UNDERWRITER, { from: brokerRep }).should.be.rejected
    })

    it('by broker', async () => {
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: false,
        underwriterApproved_: true,
        brokerApproved_: true,
        claimsAdminApproved_: false,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('and approvals are idempotent', async () => {
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
    })

    it('and approvals emit an event', async () => {
      const result = await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })

      const ev = extractEventArgs(result, events.Approved)
      expect(ev.approver).to.eq(brokerRep)
      expect(ev.role).to.eq(ROLES.BROKER)
    })

    it('by insured party', async () => {
      await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })

      await policy.getApprovalsInfo().should.eventually.matchObj({
        approved_: false,
        insuredPartyApproved_: true,
        underwriterApproved_: true,
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
        underwriterApproved_: true,
        brokerApproved_: false,
        claimsAdminApproved_: true,
      })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })
    })

    it('by everyone and this then marks it as approved', async () => {
      // NOTE: underwriter has approved in Policy.sol constructor itself
      await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })
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

      await acl.getUsersForRole(policyContext, ROLES.PENDING_UNDERWRITER).should.eventually.eql([underwriter])
      await acl.getUsersForRole(policyContext, ROLES.UNDERWRITER).should.eventually.eql([underwriter])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_BROKER).should.eventually.eql([broker])
      await acl.getUsersForRole(policyContext, ROLES.BROKER).should.eventually.eql([broker])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_INSURED_PARTY).should.eventually.eql([insuredParty])
      await acl.getUsersForRole(policyContext, ROLES.INSURED_PARTY).should.eventually.eql([insuredParty])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_CLAIMS_ADMIN).should.eventually.eql([claimsAdmin])
      await acl.getUsersForRole(policyContext, ROLES.CLAIMS_ADMIN).should.eventually.eql([claimsAdmin])
    })
  })

  describe('policy can be approved in bulk', () => {
    let sigs

    beforeEach(async () => {
      sigs = await generateApprovalSignatures({
        policyId,
        brokerRep,
        underwriterRep,
        claimsAdminRep,
        insuredPartyRep,
      })

      sigs.bad = await getAccountWallet(accounts[9]).signMessage(hre.ethers.utils.arrayify(policyId))
    })

    it('unless there are no signatures', async () => {
      await policy.bulkApprove([]).should.be.rejectedWith('wrong number of signatures')
    })

    it('unless there are not enough signatures', async () => {
      await policy.bulkApprove([ sigs.broker, sigs.underwriter, sigs.claimsAdmin ]).should.be.rejectedWith('wrong number of signatures')
    })

    it('unless signatures are badly ordered', async () => {
      await policy.bulkApprove([sigs.broker, sigs.underwriter, sigs.insuredParty, sigs.claimsAdmin]).should.be.rejectedWith('not a rep of associated entity')
    })

    it('unless even one signature is bad', async () => {
      await policy.bulkApprove([sigs.broker, sigs.underwriter, sigs.claimsAdmin, sigs.bad]).should.be.rejectedWith('not a rep of associated entity')
    })

    it('with good signatures', async () => {
      await policy.bulkApprove([sigs.broker, sigs.underwriter, sigs.claimsAdmin, sigs.insuredParty]).should.be.fulfilled
    })

    it('and emits an event', async () => {
      const result = await policy.bulkApprove([sigs.broker, sigs.underwriter, sigs.claimsAdmin, sigs.insuredParty])

      const ev = extractEventArgs(result, events.BulkApproved)
      expect(ev.caller).to.eq(accounts[0])
    })

    it('and updates internal state', async () => {
      await policy.bulkApprove([sigs.broker, sigs.underwriter, sigs.claimsAdmin, sigs.insuredParty])

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

      await acl.getUsersForRole(policyContext, ROLES.PENDING_UNDERWRITER).should.eventually.eql([underwriter])
      await acl.getUsersForRole(policyContext, ROLES.UNDERWRITER).should.eventually.eql([underwriter])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_BROKER).should.eventually.eql([broker])
      await acl.getUsersForRole(policyContext, ROLES.BROKER).should.eventually.eql([broker])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_INSURED_PARTY).should.eventually.eql([insuredParty])
      await acl.getUsersForRole(policyContext, ROLES.INSURED_PARTY).should.eventually.eql([insuredParty])

      await acl.getUsersForRole(policyContext, ROLES.PENDING_CLAIMS_ADMIN).should.eventually.eql([claimsAdmin])
      await acl.getUsersForRole(policyContext, ROLES.CLAIMS_ADMIN).should.eventually.eql([claimsAdmin])
    })

    it('and works even if manual approvals have happend beforehand', async () => {
      await policy.approve(ROLES.PENDING_INSURED_PARTY, { from: insuredPartyRep })

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_IN_APPROVAL
      })

      await policy.bulkApprove([sigs.broker, sigs.underwriter, sigs.claimsAdmin, sigs.insuredParty])

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_APPROVED
      })
    })

    it('and works when creating the policy', async () => {

      await entity.updateAllowPolicy(true)

      const createPolicyTx = await createPolicy(entity, {
        policyId,
        initiationDate,
        startDate,
        maturationDate,
        unit: etherToken.address,
        underwriter,
        insuredParty,
        broker,
        claimsAdmin,
        approvalSignatures: [ sigs.broker, sigs.underwriter, sigs.claimsAdmin, sigs.insuredParty ],
      }, { from: entityManagerAddress })

      await entity.updateAllowPolicy(false)

      const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy
      const policy2 = await IPolicy.at(policyAddress)
      await policy2.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_APPROVED
      })
    })
  })
})

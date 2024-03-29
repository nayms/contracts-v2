import {
  extractEventArgs,
  parseEvents,
  createTranche,
  createPolicy,
  createEntity,
  EvmClock,
  EvmSnapshot,
  ADDRESS_ZERO,
  doPolicyApproval,
} from './utils'

import { events } from '..'
import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureMarketIsDeployed } from '../deploy/modules/market'
import { ensureEntityDeployerIsDeployed } from '../deploy/modules/entityDeployer'
import { ensureEntityImplementationsAreDeployed } from '../deploy/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../deploy/modules/policyImplementations'
import { getAccounts } from '../deploy/utils'

const IEntityTreasuryTestFacet = artifacts.require("test/IEntityTreasuryTestFacet")
const IEntity = artifacts.require('base/IEntity')
const IPolicyTreasury = artifacts.require('base/IPolicyTreasury')
const IPolicyTypes = artifacts.require('base/IPolicyTypes')
const Entity = artifacts.require('Entity')
const IPolicyStates = artifacts.require("base/IPolicyStates")
const Policy = artifacts.require("Policy")
const DummyToken = artifacts.require("DummyToken")
const IPolicy = artifacts.require("IPolicy")
const IERC20 = artifacts.require("base/IERC20")

describe('Integration: Portfolio underwriting', () => {
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
  let entity
  let baseDate
  let initiationDate
  let startDate
  let maturationDate
  let market
  let etherToken
  let policyOwnerAddress

  let systemManager
  let entityManagerAddress
  let entityAdminAddress
  let insuredPartyRep
  let underwriterRep
  let brokerRep
  let claimsAdminRep

  let insuredParty
  let underwriter
  let broker
  let claimsAdmin

  let treasury
  let entityTreasuryTestFacet

  let POLICY_STATE_CREATED
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let POLICY_STATE_IN_APPROVAL
  let POLICY_STATE_APPROVED
  let POLICY_STATE_CANCELLED
  let POLICY_STATE_BUYBACK
  let POLICY_STATE_CLOSED

  let POLICY_TYPE_PORTFOLIO
  
  let TRANCHE_STATE_CREATED
  let TRANCHE_STATE_SELLING
  let TRANCHE_STATE_ACTIVE
  let TRANCHE_STATE_MATURED
  let TRANCHE_STATE_CANCELLED

  let getTrancheToken
  let approvePolicy

  let evmClock

  before(async () => {
    accounts = await getAccounts()

    systemManager = accounts[0]
    entityManagerAddress = accounts[1]
    entityAdminAddress = accounts[2]
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
    await ensureEntityImplementationsAreDeployed({ artifacts, settings, entityDeployer, extraFacets: [ 'test/EntityTreasuryTestFacet' ] })
    
    await acl.assignRole(systemContext, systemManager, ROLES.SYSTEM_MANAGER)

    const entityAddress = await createEntity({ entityDeployer, adminAddress: entityAdminAddress })
    const entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    const entityContext = await entityProxy.aclContext()

    // entity test facet
    entityTreasuryTestFacet = await IEntityTreasuryTestFacet.at(entityAddress)

    // entity manager
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER)

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

    await entity.updateAllowPolicy(true)

    const createPolicyTx = await createPolicy(entity, {
      type: 1 /* portfolio type */,
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
    }, { from: entityManagerAddress })

    await entity.updateAllowPolicy(false)

    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy
    policyOwnerAddress = entityManagerAddress

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicy.at(policyAddress)
    const policyContext = await policyProxy.aclContext()

    treasury = await IPolicyTreasury.at(entity.address)

    // get market address
    market = await ensureMarketIsDeployed({ artifacts, settings })

    // setup two tranches
    await createTranche(policy, {
      numShares: 100,
      pricePerShareAmount: 2,
      premiumsDiff: [0, 10 ,500 , 20, 1000, 30, 1500, 40, 2000, 50, 2500, 60, 3000, 70 ]
    }, { from: policyOwnerAddress })

    await createTranche(policy, {
      numShares: 50,
      pricePerShareAmount: 2,
      premiumsDiff: [0, 10 ,500 , 20, 1000, 30, 1500, 40, 2000, 50, 2500, 60, 3000, 70 ]
    }, { from: policyOwnerAddress })

    getTrancheToken = async idx => {
      const { token_: tt } = await policy.getTrancheInfo(idx)
      return await IERC20.at(tt)
    }

    approvePolicy = async () => {
      await doPolicyApproval({ policy, insuredPartyRep, underwriterRep, brokerRep, claimsAdminRep })
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_APPROVED })
    }

    const policyStates = await IPolicyStates.at(policyCoreAddress)

    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_CANCELLED = await policyStates.POLICY_STATE_CANCELLED()
    POLICY_STATE_IN_APPROVAL = await policyStates.POLICY_STATE_IN_APPROVAL()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()
    POLICY_STATE_BUYBACK = await policyStates.POLICY_STATE_BUYBACK()
    POLICY_STATE_CLOSED = await policyStates.POLICY_STATE_CLOSED()

    const policyTypes = await IPolicyTypes.at(policyCoreAddress)
    POLICY_TYPE_PORTFOLIO = await policyTypes.POLICY_TYPE_PORTFOLIO()

    TRANCHE_STATE_CREATED = await policyStates.TRANCHE_STATE_CREATED()
    TRANCHE_STATE_SELLING = await policyStates.TRANCHE_STATE_SELLING()
    TRANCHE_STATE_ACTIVE = await policyStates.TRANCHE_STATE_ACTIVE()
    TRANCHE_STATE_MATURED = await policyStates.TRANCHE_STATE_MATURED()
    TRANCHE_STATE_CANCELLED = await policyStates.TRANCHE_STATE_CANCELLED()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
    evmClock = new EvmClock(baseDate)
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('returns the correct info', async () => {
    await policy.getInfo().should.eventually.matchObj({
      numTranches_: 2,
      type_: POLICY_TYPE_PORTFOLIO,
    })
  })

  it('tranche tokens do not exist', async () => {
    await policy.getTrancheInfo(0).should.eventually.matchObj({
      token_: ADDRESS_ZERO,
    })

    await policy.getTrancheInfo(1).should.eventually.matchObj({
      token_: ADDRESS_ZERO,
    })
  })

  describe('even once policy has been approved', () => {
    beforeEach(async () => {
      await approvePolicy()
    })

    describe('once initialisation date has passed', () => {
      beforeEach(async () => {
        await etherToken.deposit({ value: 20 })
        await etherToken.approve(policy.address, 20)
        await policy.payTranchePremium(0, 10)
        await policy.payTranchePremium(1, 10)
        
        await evmClock.setAbsoluteTime(initiationDate)
        await policy.checkAndUpdateState()
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_INITIATED })
      })

      it('tranche tokens are not being sold', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: 0,
        })
        await policy.getTrancheInfo(1).should.eventually.matchObj({
          initialSaleOfferId_: 0,
        })
      })

      it('tranches remain in created state', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          state_: TRANCHE_STATE_CREATED,
        })
        await policy.getTrancheInfo(1).should.eventually.matchObj({
          state_: TRANCHE_STATE_CREATED,
        })
      })

      describe('once start date has passed', () => {
        beforeEach(async () => {
          // pay all remaining premiums
          await etherToken.deposit({ value: 540 })
          await etherToken.approve(policy.address, 540)
          await policy.payTranchePremium(0, 270)
          await policy.payTranchePremium(1, 270)

          await evmClock.setAbsoluteTime(startDate)
          await policy.checkAndUpdateState()
        })

        it('tranches are in active state', async () => {
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_ACTIVE,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_ACTIVE,
          })
        })

        it('policy is active', async () => {
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
        })

        describe('once maturation date has passed', () => {
          describe('if there are no pending claims', () => {
            beforeEach(async () => {
              await evmClock.setAbsoluteTime(maturationDate)
              await policy.checkAndUpdateState()
            })

            it('policy is closed', async () => {
              await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CLOSED })
            })

            it('no token buyback is initiated', async () => {
              await policy.getTrancheInfo(0).should.eventually.matchObj({
                finalBuybackofferId_: 0,
              })
              await policy.getTrancheInfo(1).should.eventually.matchObj({
                finalBuybackofferId_: 0,
              })
            })
          })

          describe('if there are pending claims', () => {
            beforeEach(async () => {
              await policy.makeClaim(0, 1, { from: insuredPartyRep })
              await policy.makeClaim(0, 2, { from: insuredPartyRep })

              await evmClock.setAbsoluteTime(maturationDate)
              await policy.checkAndUpdateState()
            })

            it('policy is matured', async () => {
              await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
            })

            describe('once the claims are paid', () => {
              beforeEach(async () => {
                await policy.declineClaim(0, { from: claimsAdminRep })
                await policy.declineClaim(1, { from: claimsAdminRep })
              })

              it('it gets closed', async () => {
                await policy.checkAndUpdateState()
                await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CLOSED })
              })
            })
          })
        })
      })
    })
  })
})

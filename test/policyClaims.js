
import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranche,
  preSetupPolicy,
  doPolicyApproval,
  EvmClock,
  EvmSnapshot,
  createEntity,
} from './utils'
import { events } from '..'
import { ROLES } from '../utils/constants'
import { getAccounts } from '../deploy/utils'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../deploy/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../deploy/modules/market'
import { ensureFeeBankIsDeployed } from '../deploy/modules/feeBank'
import { ensureEntityImplementationsAreDeployed } from '../deploy/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../deploy/modules/policyImplementations'

const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const IPolicyClaimsFacet = artifacts.require("./base/IPolicyClaimsFacet")
const Policy = artifacts.require("./Policy")
const DummyToken = artifacts.require("./DummyToken")
const IPolicy = artifacts.require("./base/IPolicy")
const IMarketFeeSchedules = artifacts.require("base/IMarketFeeSchedules")

const POLICY_ATTRS_1 = {
  initiationDateDiff: 1000,
  startDateDiff: 2000,
  maturationDateDiff: 3000,
  premiumIntervalSeconds: 30,
  claimsAdminCommissionBP: 0,
  brokerCommissionBP: 0,
  naymsCommissionBP: 0,
}

const POLICY_ATTRS_2 = Object.assign({}, POLICY_ATTRS_1, {
  initiationDateDiff: 100,
  startDateDiff: 1000,
  maturationDateDiff: 5000,
  premiumIntervalSeconds: 100,
})

const POLICY_ATTRS_3 = Object.assign({}, POLICY_ATTRS_1, {
  initiationDateDiff: 100,
  startDateDiff: 1000,
  maturationDateDiff: 1000,
  premiumIntervalSeconds: 100,
})

const POLICY_ATTRS_4 = Object.assign({}, POLICY_ATTRS_1, {
  initiationDateDiff: 1000,
  startDateDiff: 2000,
  maturationDateDiff: 10000,
  premiumIntervalSeconds: 1000,
})

describe('Policy: Claims', () => {
  const evmSnapshot = new EvmSnapshot()
  let evmClock

  let accounts
  let acl
  let systemContext
  let settings
  let entityDeployer
  let entityProxy
  let entity
  let entityContext
  let policyProxy
  let policy
  let policyCoreAddress
  let policyClaimsAddress
  let policyContext
  let policyOwnerAddress
  let market
  let etherToken

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
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let POLICY_STATE_IN_APPROVAL
  let POLICY_STATE_APPROVED
  let POLICY_STATE_CANCELLED
  let POLICY_STATE_BUYBACK

  let TRANCHE_STATE_CANCELLED
  let TRANCHE_STATE_ACTIVE
  let TRANCHE_STATE_MATURED

  let CLAIM_STATE_CREATED
  let CLAIM_STATE_DISPUTED
  let CLAIM_STATE_APPROVED
  let CLAIM_STATE_DECLINED
  let CLAIM_STATE_PAID

  let FEE_SCHEDULE_STANDARD
  let FEE_SCHEDULE_PLATFORM_ACTION

  let approvePolicy
  let setupPolicyForClaims
  const policies = new Map()

  let buyAllTrancheTokens

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

    // market
    market = await ensureMarketIsDeployed({ artifacts, settings })

    // registry + wrappedEth
    etherToken = await DummyToken.new('Token 1', 'TOK1', 18, 0, false)

    // fee bank
    ensureFeeBankIsDeployed({ artifacts, settings })

    // entity
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings, entityDeployer })

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)

    const entityAddress = await createEntity({ entityDeployer, adminAddress: entityAdminAddress })

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER)

    ;({ facets: [ policyCoreAddress, policyClaimsAddress ] } = await ensurePolicyImplementationsAreDeployed({ artifacts, settings }))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_CANCELLED = await policyStates.POLICY_STATE_CANCELLED()
    POLICY_STATE_IN_APPROVAL = await policyStates.POLICY_STATE_IN_APPROVAL()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()
    POLICY_STATE_BUYBACK = await policyStates.POLICY_STATE_BUYBACK()

    TRANCHE_STATE_CANCELLED = await policyStates.TRANCHE_STATE_CANCELLED()
    TRANCHE_STATE_ACTIVE = await policyStates.TRANCHE_STATE_ACTIVE()
    TRANCHE_STATE_MATURED = await policyStates.TRANCHE_STATE_MATURED()

    const claimsFacet = await IPolicyClaimsFacet.at(policyClaimsAddress)
    CLAIM_STATE_CREATED = await claimsFacet.CLAIM_STATE_CREATED()
    CLAIM_STATE_APPROVED = await claimsFacet.CLAIM_STATE_APPROVED()
    CLAIM_STATE_DECLINED = await claimsFacet.CLAIM_STATE_DECLINED()
    CLAIM_STATE_PAID = await claimsFacet.CLAIM_STATE_PAID()

    const { facets: [marketCoreAddress] } = market
    const mktFeeSchedules = await IMarketFeeSchedules.at(marketCoreAddress)
    FEE_SCHEDULE_STANDARD = await mktFeeSchedules.FEE_SCHEDULE_STANDARD()
    FEE_SCHEDULE_PLATFORM_ACTION = await mktFeeSchedules.FEE_SCHEDULE_PLATFORM_ACTION()

    const preSetupPolicyForClaims = async (ctx, attrs) => {
      await preSetupPolicy(ctx, attrs)

      const { policyAddress } = policies.get(attrs)

      policy = await IPolicy.at(policyAddress)
      policyOwnerAddress = entityManagerAddress

      await createTranche(policy, {
        premiumsDiff: [0, 2000, attrs.premiumIntervalSeconds, 3000, attrs.premiumIntervalSeconds * 2, 4000]
      }, { from: policyOwnerAddress })

      await createTranche(policy, {
        premiumsDiff: [0, 7000, attrs.premiumIntervalSeconds, 1000, attrs.premiumIntervalSeconds * 2, 5000]
      }, { from: policyOwnerAddress })

      await createTranche(policy, {  // this tranche will be cancelled because we won't pay all the premiums
        premiumsDiff: [0, 7000, attrs.premiumIntervalSeconds, 1000, attrs.premiumIntervalSeconds * 2, 5000]
      }, { from: policyOwnerAddress })

      await createTranche(policy, {  // this tranche will be cancelled because we won't pay all the premiums
        premiumsDiff: [0, 7000, attrs.premiumIntervalSeconds, 1000, attrs.premiumIntervalSeconds * 2, 5000]
      }, { from: policyOwnerAddress })

      // now pay premiums
      await etherToken.deposit({ value: 50000 })
      await etherToken.approve(policy.address, 50000)

      // pay 100%
      await policy.payTranchePremium(0, 9000)

      // pay 90%
      await policy.payTranchePremium(1, 13000 * 0.9)

      // pay 1 (so it's cancelled by the start date time)
      await policy.payTranchePremium(2, 7000)

      // pay 2 (so it's active by the start date time but should be cancelled after that)
      await policy.payTranchePremium(3, 8000)
    }

    underwriter = await createEntity({ entityDeployer, adminAddress: underwriterRep, entityContext, acl })
    insuredParty = await createEntity({ entityDeployer, adminAddress: insuredPartyRep })
    broker = await createEntity({ entityDeployer, adminAddress: brokerRep })
    claimsAdmin = await createEntity({ entityDeployer, adminAddress: claimsAdminRep })

    const approvers = { underwriter, insuredParty, broker, claimsAdmin }

    Object.assign(POLICY_ATTRS_1, approvers)
    Object.assign(POLICY_ATTRS_2, approvers)
    Object.assign(POLICY_ATTRS_3, approvers)
    Object.assign(POLICY_ATTRS_4, approvers)

    const preSetupPolicyCtx = { policies, settings, events, etherToken, entity, entityManagerAddress }
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_1)
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_2)
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_3)
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_4)

    approvePolicy = async () => {
      await doPolicyApproval({ policy, underwriterRep, claimsAdminRep, brokerRep, insuredPartyRep })
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_APPROVED })
    }

    setupPolicyForClaims = async (attrs, { skipApprovals = false } = {}) => {
      const { baseTime, policyAddress } = policies.get(attrs)

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicy.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress

      // approve policy
      if (!skipApprovals) {
        await approvePolicy()
      }

      const { token_: tranche0Address } = await policy.getTrancheInfo(0)
      const { token_: tranche1Address } = await policy.getTrancheInfo(1)
      const { token_: tranche2Address } = await policy.getTrancheInfo(2)
      const { token_: tranche3Address } = await policy.getTrancheInfo(3)

      buyAllTrancheTokens = async () => {
        await etherToken.deposit({ value: 40 })
        await etherToken.approve(market.address, 40)
        await market.executeLimitOffer(etherToken.address, 10, tranche0Address, 10, FEE_SCHEDULE_STANDARD)
        await market.executeLimitOffer(etherToken.address, 10, tranche1Address, 10, FEE_SCHEDULE_STANDARD)
        await market.executeLimitOffer(etherToken.address, 10, tranche2Address, 10, FEE_SCHEDULE_STANDARD)
        await market.executeLimitOffer(etherToken.address, 10, tranche3Address, 10, FEE_SCHEDULE_STANDARD)
      }

      evmClock = new EvmClock(baseTime)
    }
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('claims', () => {
    it('cannot be made in created state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_1, { skipApprovals: true })
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CREATED })
      await policy.makeClaim(0, 1).should.be.rejectedWith('must be in active state')
    })

    it('cannot be made in in-approval state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_1, { skipApprovals: true })
      await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_IN_APPROVAL })
      await policy.makeClaim(0, 1).should.be.rejectedWith('must be in active state')
    })

    it('cannot be made in approved state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_1)
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_APPROVED })
      await policy.makeClaim(0, 1).should.be.rejectedWith('must be in active state')
    })

    it('cannot be made in initiated state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_2)
      await evmClock.setRelativeTime(100)
      await policy.checkAndUpdateState()
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_INITIATED })
      await policy.makeClaim(0, 1).should.be.rejectedWith('must be in active state')
    })

    it('can be made in active state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_2)

      await evmClock.setRelativeTime(100)
      await policy.checkAndUpdateState()
      await evmClock.setRelativeTime(1000)
      await buyAllTrancheTokens()
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTrancheInfo(0).should.eventually.matchObj({
        state_: TRANCHE_STATE_ACTIVE
      })

      await policy.makeClaim(0, 1, { from: insuredPartyRep }).should.be.fulfilled
    })

    it('cannot be made in matured state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_3)

      await evmClock.setRelativeTime(100)
      await policy.checkAndUpdateState()
      await buyAllTrancheTokens()
      await evmClock.setRelativeTime(1000)
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })
      await policy.getTrancheInfo(0).should.eventually.matchObj({
        state_: TRANCHE_STATE_MATURED
      })

      await policy.makeClaim(0, 1, { from: insuredPartyRep }).should.be.rejectedWith('must be in active state')
    })

    describe('when in active state', () => {
      let insuredPartyAddress

      beforeEach(async () => {
        await setupPolicyForClaims(POLICY_ATTRS_4)
        await evmClock.setRelativeTime(1000)
        await policy.checkAndUpdateState()
        await evmClock.setRelativeTime(2000) // expect 2 premium payments to have been paid for every tranche by this point
        await buyAllTrancheTokens()
        await policy.checkAndUpdateState()
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      })

      it('must be made by insured partys', async () => {
        await policy.makeClaim(0, 1).should.be.rejectedWith('not a rep of associated entity')
      })

      describe('if made by insured party', () => {
        it('claim must be against an active tranche (and it will call the heartbeat first to check)', async () => {
          await policy.getTrancheInfo(3).should.eventually.matchObj({
            state_: TRANCHE_STATE_ACTIVE
          })

          // past next premium payment interval
          await evmClock.setRelativeTime(4000)

          await policy.makeClaim(3, 1, { from: insuredPartyRep }).should.be.rejectedWith('tranche must be active');
        })

        it('claim must be against an active tranche', async () => {
          await policy.getTrancheInfo(2).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED
          })
          await policy.makeClaim(2, 1, { from: insuredPartyRep }).should.be.rejectedWith('tranche must be active');
        })

        it('claim must be less than available balance', async () => {
          const trancheBalance = (await policy.getTrancheInfo(0)).balance_.toNumber()

          await policy.makeClaim(0, trancheBalance + 1, { from: insuredPartyRep }).should.be.rejectedWith('claim too high')
          await policy.makeClaim(0, trancheBalance, { from: insuredPartyRep }).should.be.fulfilled
        })

        it('claim must be less than available balance, taking into account existing pending claims', async () => {
          const trancheBalance = (await policy.getTrancheInfo(0)).balance_.toNumber()

          await policy.makeClaim(0, trancheBalance, { from: insuredPartyRep }).should.be.fulfilled
          await policy.makeClaim(0, 1, { from: insuredPartyRep }).should.be.rejectedWith('claim too high')
          await policy.makeClaim(1, 1, { from: insuredPartyRep }).should.be.fulfilled
        })

        it('emits an event', async () => {
          const ret = await policy.makeClaim(0, 4, { from: insuredPartyRep })

          expect(extractEventArgs(ret, events.NewClaim)).to.include({
            trancheIndex: '0',
            claimIndex: '0'
          })
        })

        it('claim updates internal stats', async () => {
          await policy.makeClaim(0, 4, { from: insuredPartyRep }).should.be.fulfilled
          await policy.makeClaim(1, 1, { from: insuredPartyRep }).should.be.fulfilled
          await policy.makeClaim(1, 5, { from: insuredPartyRep }).should.be.fulfilled

          await policy.getClaimStats().should.eventually.matchObj({
            numClaims_: 3,
            numPendingClaims_: 3,
          })

          await policy.getClaimInfo(0).should.eventually.matchObj({
            amount_: 4,
            trancheIndex_: 0,
            state_: CLAIM_STATE_CREATED,
            disputed_: false,
            acknowledged: false,
          })

          await policy.getClaimInfo(1).should.eventually.matchObj({
            amount_: 1,
            trancheIndex_: 1,
            state_: CLAIM_STATE_CREATED,
            disputed_: false,
            acknowledged: false,
          })

          await policy.getClaimInfo(2).should.eventually.matchObj({
            amount_: 5,
            trancheIndex_: 1,
            state_: CLAIM_STATE_CREATED,
            disputed_: false,
            acknowledged: false,
          })
        })

        describe('and claims can be declined', async () => {
          beforeEach(async () => {
            await policy.makeClaim(0, 4, { from: insuredPartyRep }).should.be.fulfilled
            await policy.makeClaim(1, 1, { from: insuredPartyRep }).should.be.fulfilled
            await policy.makeClaim(1, 5, { from: insuredPartyRep }).should.be.fulfilled
          })

          it('but not if not claims admin', async () => {
            await policy.declineClaim(0).should.be.rejectedWith('not a rep of associated entity')
          })

          it('but not if claim is invalid', async () => {
            await policy.declineClaim(5, { from: claimsAdminRep }).should.be.rejectedWith('invalid claim')
          })

          it('cannot decline twice', async () => {
            await policy.declineClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.declineClaim(0, { from: claimsAdminRep }).should.be.rejectedWith('in wrong state')
          })

          it('cannot decline if already approved', async () => {
            await policy.approveClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.declineClaim(0, { from: claimsAdminRep }).should.be.rejectedWith('in wrong state')
          })

          it('and no longer counts towards pending balance', async () => {
            const trancheBalance = (await policy.getTrancheInfo(0)).balance_.toNumber()

            await policy.makeClaim(0, trancheBalance, { from: insuredPartyRep }).should.be.rejectedWith('claim too high')
            await policy.declineClaim(0, { from: claimsAdminRep })
            await policy.makeClaim(0, trancheBalance, { from: insuredPartyRep }).should.be.fulfilled
          })

          it('can decline even if disputed', async () => {
            await policy.disputeClaim(0, { from: underwriterRep })
            await policy.declineClaim(0, { from: claimsAdminRep })
          })

          it('emits an event', async () => {
            const ret = await policy.declineClaim(0, { from: claimsAdminRep })

            expect(extractEventArgs(ret, events.ClaimStateUpdated)).to.include({
              claimIndex: '0',
              newState: `${CLAIM_STATE_DECLINED}`,
            })
          })

          it('updates internal stats', async () => {
            await policy.declineClaim(0, { from: claimsAdminRep }).should.be.fulfilled

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 3,
              numPendingClaims_: 2,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              state_: CLAIM_STATE_DECLINED,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
            })
          })

          it('leaves tranche balance unchanged', async () => {
            const trancheBalance = ((await policy.getTrancheInfo(0))).balance_.toNumber()

            await policy.declineClaim(0, { from: claimsAdminRep })

            await policy.getTrancheInfo(0).should.eventually.matchObj({
              balance_: trancheBalance
            })
          })
        })

        describe('and claims can be approved', async () => {
          beforeEach(async () => {
            await policy.makeClaim(0, 4, { from: insuredPartyRep }).should.be.fulfilled
            await policy.makeClaim(1, 1, { from: insuredPartyRep }).should.be.fulfilled
            await policy.makeClaim(1, 5, { from: insuredPartyRep }).should.be.fulfilled
          })

          it('but not if not a claims admin', async () => {
            await policy.approveClaim(0).should.be.rejectedWith('not a rep of associated entity')
          })

          it('but not if claim is invalid', async () => {
            await policy.approveClaim(5, { from: claimsAdminRep }).should.be.rejectedWith('invalid claim')
          })

          it('cannot approve twice', async () => {
            await policy.approveClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.approveClaim(0, { from: claimsAdminRep }).should.be.rejectedWith('in wrong state')
          })

          it('cannot approve if alrady declined', async () => {
            await policy.declineClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.approveClaim(0, { from: claimsAdminRep }).should.be.rejectedWith('in wrong state')
          })

          it('can approve even if disputed', async () => {
            await policy.disputeClaim(0, { from: underwriterRep })
            await policy.approveClaim(0, { from: claimsAdminRep })
          })

          it('emits an event', async () => {
            const ret = await policy.approveClaim(0, { from: claimsAdminRep })

            expect(extractEventArgs(ret, events.ClaimStateUpdated)).to.include({
              claimIndex: '0',
              newState: `${CLAIM_STATE_APPROVED}`,
            })
          })

          it('updates internal stats', async () => {
            await policy.approveClaim(0, { from: claimsAdminRep }).should.be.fulfilled

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 3,
              numPendingClaims_: 2,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              state_: CLAIM_STATE_APPROVED,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
            })
          })

          it('updates tranche balance', async () => {
            const trancheBalance = (await policy.getTrancheInfo(0)).balance_.toNumber()

            await policy.approveClaim(0, { from: claimsAdminRep })

            await policy.getTrancheInfo(0).should.eventually.matchObj({
              balance_: trancheBalance - 4
            })
          })
        })

        describe('claims can be disputed', () => {
          beforeEach(async () => {
            await policy.makeClaim(0, 4, { from: insuredPartyRep })
          })

          it('but not if not underwriter', async () => {
            await policy.disputeClaim(0, { from: insuredPartyRep }).should.be.rejectedWith('not a rep of associated entity')
          })

          it('but not if claim is invalid', async () => {
            await policy.disputeClaim(5, { from: underwriterRep }).should.be.rejectedWith('invalid claim')
          })

          it('can do twice', async () => {
            await policy.disputeClaim(0, { from: underwriterRep }).should.be.fulfilled
            await policy.disputeClaim(0, { from: underwriterRep }).should.be.fulfilled
          })

          it('can do if already acknowledged', async () => {
            await policy.acknowledgeClaim(0, { from: underwriterRep }).should.be.fulfilled
            await policy.disputeClaim(0, { from: underwriterRep }).should.be.fulfilled
          })

          it('cannot do if already approved', async () => {
            await policy.approveClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.disputeClaim(0, { from: underwriterRep }).should.be.rejectedWith('in wrong state')
          })

          it('cannot do if already declined', async () => {
            await policy.declineClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.disputeClaim(0, { from: underwriterRep }).should.be.rejectedWith('in wrong state')
          })

          it('updates internal stats', async () => {
            await policy.disputeClaim(0, { from: underwriterRep }).should.be.fulfilled

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 1,
              numPendingClaims_: 1,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
              disputed_: true,
              acknowledged: false,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
              disputed_: false,
              acknowledged: false,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
              disputed_: false,
              acknowledged: false,
            })
          })
        })

        describe('claims can be acknowledged', () => {
          beforeEach(async () => {
            await policy.makeClaim(0, 4, { from: insuredPartyRep })
          })

          it('but not if not underwriter', async () => {
            await policy.acknowledgeClaim(0, { from: insuredPartyRep }).should.be.rejectedWith('not a rep of associated entity')
          })

          it('but not if claim is invalid', async () => {
            await policy.acknowledgeClaim(5, { from: underwriterRep }).should.be.rejectedWith('invalid claim')
          })

          it('can do twice', async () => {
            await policy.acknowledgeClaim(0, { from: underwriterRep }).should.be.fulfilled
            await policy.acknowledgeClaim(0, { from: underwriterRep }).should.be.fulfilled
          })

          it('cannot do if already approved', async () => {
            await policy.approveClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.acknowledgeClaim(0, { from: underwriterRep }).should.be.rejectedWith('in wrong state')
          })

          it('can do if already disputed', async () => {
            await policy.disputeClaim(0, { from: underwriterRep }).should.be.fulfilled
            await policy.acknowledgeClaim(0, { from: underwriterRep }).should.be.fulfilled
          })

          it('cannot do if already declined', async () => {
            await policy.declineClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            await policy.acknowledgeClaim(0, { from: underwriterRep }).should.be.rejectedWith('in wrong state')
          })

          it('updates internal stats', async () => {
            await policy.acknowledgeClaim(0, { from: underwriterRep }).should.be.fulfilled

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 1,
              numPendingClaims_: 1,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
              disputed_: false,
              acknowledged: true,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
              disputed_: false,
              acknowledged: false,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              state_: CLAIM_STATE_CREATED,
              disputed_: false,
              acknowledged: false,
            })
          })
        })

        describe('and claims can be paid out once approved and/or declined', async () => {
          beforeEach(async () => {
            await policy.makeClaim(0, 4, { from: insuredPartyRep })
            await policy.makeClaim(0, 2, { from: insuredPartyRep })
            await policy.makeClaim(1, 1, { from: insuredPartyRep })
            await policy.makeClaim(1, 5, { from: insuredPartyRep })

            await policy.approveClaim(0, { from: claimsAdminRep })
            await policy.declineClaim(1, { from: claimsAdminRep })
            await policy.approveClaim(2, { from: claimsAdminRep })
            await policy.disputeClaim(3, { from: underwriterRep })
          })

          it('but not just by anyone', async () => {
            await policy.payClaim(0, { from: accounts[4] }).should.be.rejectedWith('not a rep of associated entity')
          })

          describe('and when the premiums are NOT fully paid', async () => {
            it('the payout fails', async () => {
              await policy.payClaim(2, { from: claimsAdminRep }).should.be.rejectedWith('not possible until premiums are fully paid')
            })

            it('but then succeeds once premiums are fully paid', async () => {
              await policy.payTranchePremium(1, 13000 * 0.1)
              await policy.payClaim(2, { from: claimsAdminRep }).should.be.fulfilled
            })
          })

          describe('and when the premiums are fully paid', async () => {
            beforeEach(async () => {
              await policy.payTranchePremium(1, 13000 * 0.1)
            })

            it('by claims admin', async () => {
              await policy.payClaim(0, { from: claimsAdminRep }).should.be.fulfilled
            })

            it('and an event gets emitted', async () => {
              const ret = await policy.payClaim(0, { from: claimsAdminRep })

              expect(extractEventArgs(ret, events.ClaimStateUpdated)).to.exist
            })

            it('and the payout goes to the insured party entities', async () => {
              const preBalance = ((await etherToken.balanceOf(insuredParty))).toNumber()

              await policy.payClaim(0, { from: claimsAdminRep })

              const postBalance = ((await etherToken.balanceOf(insuredParty))).toNumber()

              expect(postBalance - preBalance).to.eq(4)

              await policy.payClaim(2, { from: claimsAdminRep })

              const postBalance2 = ((await etherToken.balanceOf(insuredParty))).toNumber()

              expect(postBalance2 - preBalance).to.eq(5)
            })

            it('and does not do payouts for un-approved claims', async () => {
              await policy.payClaim(1, { from: claimsAdminRep }).should.be.rejectedWith('not approved')
            })

            it('and only does the payouts for approved claims', async () => {
              const preBalance = ((await etherToken.balanceOf(insuredParty))).toNumber()

              await policy.payClaim(0, { from: claimsAdminRep })
              await policy.payClaim(2, { from: claimsAdminRep })

              const postBalance = ((await etherToken.balanceOf(insuredParty))).toNumber()

              expect(postBalance - preBalance).to.eq(5)
            })

            it('and it updates the treasury balance', async () => {
              const preBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

              await policy.payClaim(0, { from: claimsAdminRep })
              await policy.payClaim(2, { from: claimsAdminRep })

              const postBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

              expect(preBalance - postBalance).to.eq(5)
            })

            it('and it updates the internal stats', async () => {
              await policy.payClaim(0, { from: claimsAdminRep })

              await policy.getClaimStats().should.eventually.matchObj({
                numClaims_: 4,
                numPendingClaims_: 1,
              })

              await policy.getClaimInfo(0).should.eventually.matchObj({
                state_: CLAIM_STATE_PAID
              })

              await policy.getClaimInfo(1).should.eventually.matchObj({
                state_: CLAIM_STATE_DECLINED
              })

              await policy.getClaimInfo(2).should.eventually.matchObj({
                state_: CLAIM_STATE_APPROVED
              })

              await policy.getClaimInfo(3).should.eventually.matchObj({
                state_: CLAIM_STATE_DISPUTED
              })
            })
          })
        })
      })
    })
  })
})

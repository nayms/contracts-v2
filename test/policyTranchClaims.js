
import { keccak256, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
  preSetupPolicy,
  EvmClock,
  EvmSnapshot,
} from './utils'
import { events } from '../'

import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'

import { ensureAclIsDeployed } from '../migrations/modules/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IERC20 = artifacts.require("./base/IERC20")
const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./base/IPolicy")
const TestPolicyFacet = artifacts.require("./test/TestPolicyFacet")
const FreezeUpgradesFacet = artifacts.require("./test/FreezeUpgradesFacet")

const POLICY_ATTRS_1 = {
  initiationDateDiff: 1000,
  startDateDiff: 2000,
  maturationDateDiff: 3000,
  premiumIntervalSeconds: undefined,
  assetManagerCommissionBP: 0,
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

contract('Policy Tranches: Claims', accounts => {
  const evmSnapshot = new EvmSnapshot()
  let evmClock

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
  let policyContext
  let entityManagerAddress
  let policyOwnerAddress
  let market
  let etherToken

  let POLICY_STATE_CREATED
  let POLICY_STATE_SELLING
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED

  let TRANCH_STATE_CANCELLED
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED

  let setupPolicyForClaims
  const policies = new Map()

  let buyAllTranchTokens

  const tranchNumShares = 10
  const tranchPricePerShare = 100

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    // market
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)

    // registry + wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)

    // entity
    await ensureEntityImplementationsAreDeployed({ artifacts }, acl.address, settings.address)
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts }, acl.address, settings.address)

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_ADMIN)
    await acl.assignRole(entityContext, accounts[2], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[2]

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_SELLING = await policyStates.POLICY_STATE_SELLING()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()

    const preSetupPolicyForClaims = async (ctx, attrs) => {
      await preSetupPolicy(ctx, attrs)

      const { policyAddress } = policies.get(attrs)

      policy = await IPolicy.at(policyAddress)
      policyOwnerAddress = entityManagerAddress

      await createTranch(policy, {
        premiums: [2000, 3000, 4000]
      }, { from: policyOwnerAddress })

      await createTranch(policy, {
        premiums: [7000, 1000, 5000]
      }, { from: policyOwnerAddress })

      await createTranch(policy, {  // this tranch will be cancelled because we won't pay all the premiums
        premiums: [7000, 1000, 5000]
      }, { from: policyOwnerAddress })

      await createTranch(policy, {  // this tranch will be cancelled because we won't pay all the premiums
        premiums: [7000, 1000, 5000]
      }, { from: policyOwnerAddress })

      // now pay premiums
      await etherToken.deposit({ value: 50000 })
      await etherToken.approve(policy.address, 50000)

      // pay all
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(0)
      await policy.payTranchPremium(0)

      // pay all
      await policy.payTranchPremium(1)
      await policy.payTranchPremium(1)
      await policy.payTranchPremium(1)

      // pay 1 (so it's cancelled by the start date time)
      await policy.payTranchPremium(2)

      // pay 2 (so it's active by the start date time but should be cancelled after that)
      await policy.payTranchPremium(3)
      await policy.payTranchPremium(3)
    }

    const preSetupPolicyCtx = { policies, settings, events, etherToken, entity, entityManagerAddress }
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_1)
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_2)
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_3)
    await preSetupPolicyForClaims(preSetupPolicyCtx, POLICY_ATTRS_4)

    setupPolicyForClaims = async attrs => {
      const { baseTime, policyAddress } = policies.get(attrs)

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicy.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress

      const { token_: tranch0Address } = await policy.getTranchInfo(0)
      const { token_: tranch1Address } = await policy.getTranchInfo(1)
      const { token_: tranch2Address } = await policy.getTranchInfo(2)
      const { token_: tranch3Address } = await policy.getTranchInfo(3)

      buyAllTranchTokens = async () => {
        await etherToken.deposit({ value: 40 })
        await etherToken.approve(market.address, 40)
        await market.offer(10, etherToken.address, 10, tranch0Address, 0, false)
        await market.offer(10, etherToken.address, 10, tranch1Address, 0, false)
        await market.offer(10, etherToken.address, 10, tranch2Address, 0, false)
        await market.offer(10, etherToken.address, 10, tranch3Address, 0, false)
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
      await setupPolicyForClaims(POLICY_ATTRS_1)
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CREATED })
      await policy.makeClaim(0, entity.address, 1).should.be.rejectedWith('must be in active state')
    })

    it('cannot be made in selling state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_2)
      await evmClock.setRelativeTime(100)
      await policy.checkAndUpdateState()
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING })
      await policy.makeClaim(0, entity.address, 1).should.be.rejectedWith('must be in active state')
    })

    it('can be made in active state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_2)

      await evmClock.setRelativeTime(100)
      await policy.checkAndUpdateState()
      await evmClock.setRelativeTime(1000)
      await buyAllTranchTokens()
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_ACTIVE
      })

      await acl.assignRole(policyContext, accounts[5], ROLES.CLIENT_MANAGER);
      const clientManagerAddress = accounts[5]
      await acl.assignRole(entityContext, clientManagerAddress, ROLES.ENTITY_REP)

      await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
    })

    it('cannot be made in matured state', async () => {
      await setupPolicyForClaims(POLICY_ATTRS_3)

      await evmClock.setRelativeTime(100)
      await policy.checkAndUpdateState()
      await buyAllTranchTokens()
      await evmClock.setRelativeTime(1000)
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
      await policy.getTranchInfo(0).should.eventually.matchObj({
        state_: TRANCH_STATE_MATURED
      })

      await acl.assignRole(policyContext, accounts[5], ROLES.CLIENT_MANAGER);
      const clientManagerAddress = accounts[5]
      await acl.assignRole(entityContext, clientManagerAddress, ROLES.ENTITY_REP)

      await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('must be in active state')
    })

    describe('when in active state', () => {
      let clientManagerAddress

      beforeEach(async () => {
        await setupPolicyForClaims(POLICY_ATTRS_4)
        await evmClock.setRelativeTime(1000)
        await policy.checkAndUpdateState()
        await evmClock.setRelativeTime(2000) // expect 2 premium payments to have been paid for every tranch by this point
        await buyAllTranchTokens()
        await policy.checkAndUpdateState()
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })

        await acl.assignRole(policyContext, accounts[5], ROLES.CLIENT_MANAGER);
        clientManagerAddress = accounts[5]
      })

      it('must be made by client managers', async () => {
        await policy.makeClaim(0, accounts[1], 1).should.be.rejectedWith('must be client manager')
      })

      it('must be supplied valid client manager entity', async () => {
        await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('must have role in client manager entity')
      })

      describe('if valid client manager and entity provided', () => {
        beforeEach(async () => {
          await acl.assignRole(entityContext, clientManagerAddress, ROLES.ENTITY_REP)
        })

        it('claim must be against an active tranch (and it will call the heartbeat first to check)', async () => {
          await policy.getTranchInfo(3).should.eventually.matchObj({
            state_: TRANCH_STATE_ACTIVE
          })

          // past next premium payment interval
          await evmClock.setRelativeTime(4000)

          await policy.makeClaim(3, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('tranch must be active');
        })

        it('claim must be against an active tranch', async () => {
          await policy.getTranchInfo(2).should.eventually.matchObj({
            state_: TRANCH_STATE_CANCELLED
          })
          await policy.makeClaim(2, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('tranch must be active');
        })

        it('claim must be less than available balance', async () => {
          const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

          await policy.makeClaim(0, entity.address, tranchBalance + 1, { from: clientManagerAddress }).should.be.rejectedWith('claim too high')
          await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.fulfilled
        })

        it('claim must be less than available balance, taking into account existing pending claims', async () => {
          const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

          await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.fulfilled
          await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('claim too high')
          await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
        })

        it('emits an event', async () => {
          const ret = await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress })

          expect(extractEventArgs(ret, events.NewClaim)).to.include({
            tranchIndex: '0',
            claimIndex: '0'
          })
        })

        it('claim updates internal stats', async () => {
          await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress }).should.be.fulfilled
          await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
          await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress }).should.be.fulfilled

          await policy.getClaimStats().should.eventually.matchObj({
            numClaims_: 3,
            numPendingClaims_: 3,
          })

          await policy.getClaimInfo(0).should.eventually.matchObj({
            amount_: 4,
            tranchIndex_: 0,
            approved_: false,
            declined_: false,
            paid_: false,
            cancelled_: false,
          })

          await policy.getClaimInfo(1).should.eventually.matchObj({
            amount_: 1,
            tranchIndex_: 1,
            approved_: false,
            declined_: false,
            paid_: false,
            cancelled_: false,
          })

          await policy.getClaimInfo(2).should.eventually.matchObj({
            amount_: 5,
            tranchIndex_: 1,
            approved_: false,
            declined_: false,
            paid_: false,
            cancelled_: false,
          })
        })

        describe('and claims can be declined', async () => {
          let assetManagerAddress
          let systemManagerAddress

          beforeEach(async () => {
            await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress }).should.be.fulfilled
            await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
            await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress }).should.be.fulfilled

            await acl.assignRole(policyContext, accounts[9], ROLES.ASSET_MANAGER)
            assetManagerAddress = accounts[9]

            await acl.assignRole(policyContext, accounts[6], ROLES.SYSTEM_MANAGER)
            systemManagerAddress = accounts[6]
          })

          it('but not if not an asset manager', async () => {
            await policy.declineClaim(0).should.be.rejectedWith('must be asset manager')
          })

          it('but not if claim is invalid', async () => {
            await policy.declineClaim(5, { from: assetManagerAddress }).should.be.rejectedWith('invalid claim')
          })

          it('cannot decline twice', async () => {
            await policy.declineClaim(0, { from: assetManagerAddress }).should.be.fulfilled
            await policy.declineClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already declined')
          })

          it('cannot decline if already approved', async () => {
            await policy.approveClaim(0, { from: assetManagerAddress }).should.be.fulfilled
            await policy.declineClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already approved')
          })

          it('cannot decline if already cancelled', async () => {
            await policy.cancelClaim(0, { from: systemManagerAddress })
            await policy.declineClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already cancelled')
          })

          it('and no longer counts towards pending balance', async () => {
            const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

            await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.rejectedWith('claim too high')
            await policy.declineClaim(0, { from: assetManagerAddress })
            await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.fulfilled
          })

          it('emits an event', async () => {
            const ret = await policy.declineClaim(0, { from: assetManagerAddress })

            expect(extractEventArgs(ret, events.ClaimDeclined)).to.include({
              claimIndex: '0'
            })
          })

          it('updates internal stats', async () => {
            await policy.declineClaim(0, { from: assetManagerAddress }).should.be.fulfilled

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 3,
              numPendingClaims_: 2,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              approved_: false,
              declined_: true,
              paid_: false,
              cancelled_: false,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              approved_: false,
              declined_: false,
              paid_: false,
              cancelled_: false,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              approved_: false,
              declined_: false,
              paid_: false,
              cancelled_: false,
            })
          })

          it('leaves tranch balance unchanged', async () => {
            const tranchBalance = ((await policy.getTranchInfo(0))).balance_.toNumber()

            await policy.declineClaim(0, { from: assetManagerAddress })

            await policy.getTranchInfo(0).should.eventually.matchObj({
              balance_: tranchBalance
            })
          })
        })

        describe('and claims can be approved', async () => {
          let assetManagerAddress
          let systemManagerAddress

          beforeEach(async () => {
            await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress }).should.be.fulfilled
            await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
            await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress }).should.be.fulfilled

            await acl.assignRole(policyContext, accounts[9], ROLES.ASSET_MANAGER)
            assetManagerAddress = accounts[9]

            await acl.assignRole(policyContext, accounts[6], ROLES.SYSTEM_MANAGER)
            systemManagerAddress = accounts[6]
          })

          it('but not if not an asset manager', async () => {
            await policy.approveClaim(0).should.be.rejectedWith('must be asset manager')
          })

          it('but not if claim is invalid', async () => {
            await policy.approveClaim(5, { from: assetManagerAddress }).should.be.rejectedWith('invalid claim')
          })

          it('cannot approve twice', async () => {
            await policy.approveClaim(0, { from: assetManagerAddress }).should.be.fulfilled
            await policy.approveClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already approved')
          })

          it('cannot approve if already cancelled', async () => {
            await policy.cancelClaim(0, { from: systemManagerAddress })
            await policy.approveClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already cancelled')
          })

          it('cannot approve if alrady declined', async () => {
            await policy.declineClaim(0, { from: assetManagerAddress }).should.be.fulfilled
            await policy.approveClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already declined')
          })

          it('emits an event', async () => {
            const ret = await policy.approveClaim(0, { from: assetManagerAddress })

            expect(extractEventArgs(ret, events.ClaimApproved)).to.include({
              claimIndex: '0'
            })
          })

          it('updates internal stats', async () => {
            await policy.approveClaim(0, { from: assetManagerAddress }).should.be.fulfilled

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 3,
              numPendingClaims_: 2,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              approved_: true,
              declined_: false,
              paid_: false,
              cancelled_: false,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              approved_: false,
              declined_: false,
              paid_: false,
              cancelled_: false,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              approved_: false,
              declined_: false,
              paid_: false,
              cancelled_: false,
            })
          })

          it('updates tranch balance', async () => {
            const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

            await policy.approveClaim(0, { from: assetManagerAddress })

            await policy.getTranchInfo(0).should.eventually.matchObj({
              balance_: tranchBalance - 4
            })
          })
        })

        describe('claims can be cancelled', () => {
          let assetManagerAddress
          let systemManagerAddress

          beforeEach(async () => {
            await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress })
            await acl.assignRole(policyContext, accounts[9], ROLES.ASSET_MANAGER)

            await acl.assignRole(policyContext, accounts[6], ROLES.SYSTEM_MANAGER)
            assetManagerAddress = accounts[9]
            systemManagerAddress = accounts[6]
          })

          it('by system manager', async () => {
            await policy.cancelClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('must be system manager')
            await policy.cancelClaim(0, { from: clientManagerAddress }).should.be.rejectedWith('must be system manager')
            await policy.cancelClaim(0, { from: systemManagerAddress }).should.be.fulfilled
          })

          it('unless paid out already', async () => {
            await policy.approveClaim(0, { from: assetManagerAddress })
            await policy.payClaim(0, { from: systemManagerAddress })
            await policy.cancelClaim(0, { from: systemManagerAddress }).should.be.rejectedWith('already paid')
          })

          it('unless cancelled already', async () => {
            await policy.approveClaim(0, { from: assetManagerAddress })
            await policy.cancelClaim(0, { from: systemManagerAddress })
            await policy.cancelClaim(0, { from: systemManagerAddress }).should.be.rejectedWith('already cancelled')
          })

          it('and emits event', async () => {
            const ret = await policy.cancelClaim(0, { from: systemManagerAddress })

            expect(extractEventArgs(ret, events.ClaimCancelled)).to.exist
          })

          it('and internal stats get updated', async () => {
            await policy.approveClaim(0, { from: assetManagerAddress })
            await policy.cancelClaim(0, { from: systemManagerAddress })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              approved_: true,
              declined_: false,
              paid_: false,
              cancelled_: true,
            })
          })
        })

        describe('and claims can be paid out once approved and/or declined', async () => {
          let assetManagerAddress
          let systemManagerAddress

          beforeEach(async () => {
            await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress })
            await policy.makeClaim(0, entity.address, 2, { from: clientManagerAddress })
            await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress })
            await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress })

            await acl.assignRole(policyContext, accounts[9], ROLES.ASSET_MANAGER)
            await acl.assignRole(policyContext, accounts[6], ROLES.SYSTEM_MANAGER)
            assetManagerAddress = accounts[9]
            systemManagerAddress = accounts[6]

            await policy.approveClaim(0, { from: assetManagerAddress })
            await policy.declineClaim(1, { from: assetManagerAddress })
            await policy.approveClaim(2, { from: assetManagerAddress })

            await policy.approveClaim(3, { from: assetManagerAddress })
            await policy.cancelClaim(3, { from: systemManagerAddress })
          })

          it('but not just by anyone', async () => {
            await policy.payClaim(0, { from: accounts[4] }).should.be.rejectedWith('must be system manager')
          })

          it('by system manager', async () => {
            await policy.payClaim(0, { from: systemManagerAddress }).should.be.fulfilled
          })

          it('and an event gets emitted', async () => {
            const ret = await policy.payClaim(0)

            expect(extractEventArgs(ret, events.ClaimPaid)).to.exist
          })

          it('and the payout goes to the client manager entities', async () => {
            const preBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

            await policy.payClaim(0)

            const postBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

            expect(postBalance - preBalance).to.eq(4)

            await policy.payClaim(2)

            const postBalance2 = ((await etherToken.balanceOf(entity.address))).toNumber()

            expect(postBalance2 - preBalance).to.eq(5)
          })

          it('and does not do payouts for un-approved claims', async () => {
            await policy.payClaim(1).should.be.rejectedWith('not approved')
            await policy.payClaim(3).should.be.rejectedWith('already cancelled')
          })

          it('and only does the payouts for approved claims', async () => {
            const preBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

            await policy.payClaim(0)
            await policy.payClaim(2)

            const postBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

            expect(postBalance - preBalance).to.eq(5)
          })

          it('and it updates the internal stats', async () => {
            await policy.payClaim(0)

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 4,
              // numPendingClaims_: 0,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              approved_: true,
              declined_: false,
              paid_: true,
              cancelled_: false,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              approved_: false,
              declined_: true,
              paid_: false,
              cancelled_: false,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              approved_: true,
              declined_: false,
              paid_: false,
              cancelled_: false,
            })

            await policy.getClaimInfo(3).should.eventually.matchObj({
              approved_: true,
              declined_: false,
              paid_: false,
              cancelled_: true,
            })
          })
        })
      })
    })
  })
})

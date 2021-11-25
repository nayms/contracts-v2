import {
  extractEventArgs,
  parseEvents,
  createTranche,
  createPolicy,
  createEntity,
  doPolicyApproval,
  EvmClock,
  calcPremiumsMinusCommissions,
  EvmSnapshot,
} from './utils'

import { events } from '..'
import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureMarketIsDeployed } from '../deploy/modules/market'
import { ensureFeeBankIsDeployed } from '../deploy/modules/feeBank'
import { ensureEntityDeployerIsDeployed } from '../deploy/modules/entityDeployer'
import { ensureEntityImplementationsAreDeployed } from '../deploy/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../deploy/modules/policyImplementations'
import { getAccounts } from '../deploy/utils'

const IEntityTreasuryTestFacet = artifacts.require("test/IEntityTreasuryTestFacet")
const IEntity = artifacts.require('base/IEntity')
const IPolicyTreasury = artifacts.require('base/IPolicyTreasury')
const Entity = artifacts.require('Entity')
const IPolicyStates = artifacts.require("base/IPolicyStates")
const Policy = artifacts.require("Policy")
const DummyToken = artifacts.require("DummyToken")
const IPolicy = artifacts.require("IPolicy")
const IERC20 = artifacts.require("base/IERC20")
const IMarketFeeSchedules = artifacts.require("base/IMarketFeeSchedules")

describe('Integration: SPV', () => {
  const evmSnapshot = new EvmSnapshot()

  const claimsAdminCommissionBP = 100 /* 1% */
  const brokerCommissionBP = 200
  const naymsCommissionBP = 300
  const underwriterCommissionBP = 300

  let accounts
  let acl
  let systemContext
  let settings
  let entityDeployer
  let policyProxy
  let policy
  let entity
  let timeIntervalSeconds
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
  
  let TRANCHE_STATE_CREATED
  let TRANCHE_STATE_SELLING
  let TRANCHE_STATE_ACTIVE
  let TRANCHE_STATE_MATURED
  let TRANCHE_STATE_CANCELLED

  let FEE_SCHEDULE_STANDARD
  let FEE_SCHEDULE_PLATFORM_ACTION

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

    // fee bank
    await ensureFeeBankIsDeployed({ artifacts, settings })

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
    timeIntervalSeconds = 500

    const createPolicyTx = await createPolicy(entity, {
      initiationDate,
      startDate,
      maturationDate,
      unit: etherToken.address,
      claimsAdminCommissionBP,
      brokerCommissionBP,
      naymsCommissionBP,
      underwriterCommissionBP,
      underwriter,
      insuredParty,
      broker,
      claimsAdmin,
    }, { from: entityManagerAddress })
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
      premiumsDiff: [0, 1000 ,500 , 2000, 1000, 3000, 1500, 4000, 2000, 5000, 2500, 6000, 3000, 7000 ]
    }, { from: policyOwnerAddress })

    await createTranche(policy, {
      numShares: 50,
      pricePerShareAmount: 2,
      premiumsDiff: [0, 1000 ,500 , 2000, 1000, 3000, 1500, 4000, 2000, 5000, 2500, 6000, 3000, 7000 ]
    }, { from: policyOwnerAddress })

    getTrancheToken = async idx => {
      const { token_: tt } = await policy.getTrancheInfo(idx)
      return await IERC20.at(tt)
    }

    approvePolicy = async () => {
      await doPolicyApproval({ policy, underwriterRep, claimsAdminRep, brokerRep, insuredPartyRep })
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

    TRANCHE_STATE_CREATED = await policyStates.TRANCHE_STATE_CREATED()
    TRANCHE_STATE_SELLING = await policyStates.TRANCHE_STATE_SELLING()
    TRANCHE_STATE_ACTIVE = await policyStates.TRANCHE_STATE_ACTIVE()
    TRANCHE_STATE_MATURED = await policyStates.TRANCHE_STATE_MATURED()
    TRANCHE_STATE_CANCELLED = await policyStates.TRANCHE_STATE_CANCELLED()

    const { facets: [marketCoreAddress] } = market
    const mktFeeSchedules = await IMarketFeeSchedules.at(marketCoreAddress)
    FEE_SCHEDULE_STANDARD = await mktFeeSchedules.FEE_SCHEDULE_STANDARD()
    FEE_SCHEDULE_PLATFORM_ACTION = await mktFeeSchedules.FEE_SCHEDULE_PLATFORM_ACTION()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
    evmClock = new EvmClock(baseDate)
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('tranches begin selling', async () => {
    it('but not if initiation date has not yet passed', async () => {
      await policy.checkAndUpdateState()
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CREATED })
    })

    describe('if initiation date has passed', () => {
      it('but not if policy has not been approved', async () => {
        await evmClock.setAbsoluteTime(initiationDate)

        await policy.checkAndUpdateState().should.be.fulfilled
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CANCELLED })
      })

      describe('once policy has been approved', () => {
        beforeEach(async () => {
          await approvePolicy()
        })

        it('but not if tranche premiums have not been paid', async () => {
          await etherToken.deposit({ value: 100000 })
          await etherToken.approve(policy.address, 100000)

          // pay all tranches except the second one
          await policy.payTranchePremium(0, 1000)
          await policy.payTranchePremium(2, 1000)

          await evmClock.setAbsoluteTime(initiationDate)

          await policy.checkAndUpdateState().should.be.fulfilled
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            initialSaleOfferId_: 0,
          })
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_APPROVED })
        })

        describe('once tranche premiums are up-to-date', () => {
          beforeEach(async () => {
            await etherToken.deposit({ value: 100000 })
            await etherToken.approve(policy.address, 100000)
            await policy.payTranchePremium(0, 1000)
            await policy.payTranchePremium(1, 1000)
            await evmClock.setAbsoluteTime(initiationDate)
          })

          it('and then tranches get put on the market', async () => {
            // check order ids are not yet set
            await policy.getTrancheInfo(0).should.eventually.matchObj({
              initialSaleOfferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.matchObj({
              initialSaleOfferId_: 0,
            })

            const trancheTokens = await Promise.all([getTrancheToken(0), getTrancheToken(1)])

            await trancheTokens[0].balanceOf(market.address).should.eventually.eq(0)
            await trancheTokens[1].balanceOf(market.address).should.eventually.eq(0)

            await trancheTokens[0].balanceOf(entity.address).should.eventually.eq(100)
            await trancheTokens[1].balanceOf(entity.address).should.eventually.eq(50)

            const result = await policy.checkAndUpdateState()

            const ev = extractEventArgs(result, events.PolicyStateUpdated)
            expect(ev.state).to.eq(POLICY_STATE_INITIATED.toString())

            await trancheTokens[0].balanceOf(market.address).should.eventually.eq(100)
            await trancheTokens[1].balanceOf(market.address).should.eventually.eq(50)

            await trancheTokens[0].balanceOf(entity.address).should.eventually.eq(0)
            await trancheTokens[1].balanceOf(entity.address).should.eventually.eq(0)

            // check order ids are set
            await policy.getTrancheInfo(0).should.eventually.not.matchObj({
              initialSaleOfferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.not.matchObj({
              initialSaleOfferId_: 0,
            })
          })

          it('and the market offer uses the "platform action" fee schedule', async () => {
            await policy.checkAndUpdateState()
            
            const { initialSaleOfferId_: marketOfferId } = await policy.getTrancheInfo(0)

            await market.getOffer(marketOfferId).should.eventually.matchObj({
              feeSchedule_: FEE_SCHEDULE_PLATFORM_ACTION,
            })
          })

          it('and then policy state gets updated', async () => {
            await policy.checkAndUpdateState()
            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_INITIATED })
          })

          it('and then tranche states get updated', async () => {
            await policy.checkAndUpdateState()
            await policy.getTrancheInfo(0).should.eventually.matchObj({
              state_: TRANCHE_STATE_SELLING,
            })
            await policy.getTrancheInfo(1).should.eventually.matchObj({
              sharesSold_: 0,
            })
          })

          it('claims cannot yet be made', async () => {
            await policy.makeClaim(0, 1, { from: underwriterRep }).should.be.rejectedWith('must be in active state')
          })
        })
      })
    })
  })

  describe('once tranches begins selling', () => {
    let trancheToken
    let marketOfferId

    beforeEach(async () => {
      await approvePolicy()

      await etherToken.deposit({ value: 100000 })
      await etherToken.approve(policy.address, 10000)
      await policy.payTranchePremium(0, 1000)
      await policy.payTranchePremium(1, 1000)

      await evmClock.setAbsoluteTime(initiationDate)
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({
        state_: POLICY_STATE_INITIATED
      })

      await policy.getTrancheInfo(0).should.eventually.matchObj({
        sharesSold_: 0,
      })
      await policy.getTrancheInfo(1).should.eventually.matchObj({
        sharesSold_: 0,
      })

      trancheToken = await getTrancheToken(0)

      ;({ initialSaleOfferId_: marketOfferId } = await policy.getTrancheInfo(0))

      // get some wrapped ETH for buyer account
      await etherToken.deposit({ from: accounts[2], value: 25 })
    })

    it('claims cannot yet be made', async () => {
      await policy.makeClaim(0, 1, { from: insuredPartyRep }).should.be.rejectedWith('must be in active state')
    })

    describe('another party can make an offer that does not match', () => {
      beforeEach(async () => {
        // check initial balances
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
        await etherToken.balanceOf(policy.address).should.eventually.eq(180) /* commissions from premium payments = 9% of 2000 */
        await etherToken.balanceOf(entity.address).should.eventually.eq(1820) /* premium payments - minus commissions */
        await etherToken.balanceOf(market.address).should.eventually.eq(0)
        await trancheToken.balanceOf(accounts[2]).should.eventually.eq(0)
        await trancheToken.balanceOf(entity.address).should.eventually.eq(0)
        await trancheToken.balanceOf(market.address).should.eventually.eq(100)

        // make the offer on the market
        await etherToken.approve(market.address, 10, { from: accounts[2] })
        await market.executeLimitOffer(etherToken.address, 10, trancheToken.address, 5000, FEE_SCHEDULE_STANDARD, { from: accounts[2] })

        // check balances again
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
        await etherToken.balanceOf(policy.address).should.eventually.eq(180)
        await etherToken.balanceOf(entity.address).should.eventually.eq(1820)
        await etherToken.balanceOf(market.address).should.eventually.eq(10)
        await trancheToken.balanceOf(accounts[2]).should.eventually.eq(0)
        await trancheToken.balanceOf(entity.address).should.eventually.eq(0)
        await trancheToken.balanceOf(market.address).should.eventually.eq(100)
      })

      it('and tranche status is unchanged', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          state_: TRANCHE_STATE_SELLING,
        })
      })

      it('and tranche balance is unchanged', async () => {
        const b = (await policy.getTrancheInfo(0)).balance_
        expect(b.toNumber()).to.eq(calcPremiumsMinusCommissions({
          premiums: [1000],
          claimsAdminCommissionBP,
          brokerCommissionBP,
          naymsCommissionBP,
          underwriterCommissionBP,
        }))
      })

      it('and the tally of shares sold is unchanged', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          sharesSold_: 0,
        })
      })

      it('and market offer is still active', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: marketOfferId,
        })
        await market.isActive(marketOfferId).should.eventually.eq(true)
      })
    })

    describe('another party can make offers that do match but dont buy the tranche completely', () => {
      beforeEach(async () => {
        // check initial balances
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
        await etherToken.balanceOf(policy.address).should.eventually.eq(180) /* commissions from premium payments: 10 + 10 */
        await etherToken.balanceOf(entity.address).should.eventually.eq(1820) /* premium payments - minus commissions */
        await etherToken.balanceOf(market.address).should.eventually.eq(0)
        await trancheToken.balanceOf(accounts[2]).should.eventually.eq(0)
        await trancheToken.balanceOf(entity.address).should.eventually.eq(0)
        await trancheToken.balanceOf(market.address).should.eventually.eq(100)

        // make some offers on the market
        await etherToken.approve(market.address, 10, { from: accounts[2] })
        await market.executeLimitOffer(etherToken.address, 4, trancheToken.address, 2, FEE_SCHEDULE_STANDARD, { from: accounts[2] })
        await market.executeLimitOffer(etherToken.address, 6, trancheToken.address, 3, FEE_SCHEDULE_STANDARD, { from: accounts[2] })

        // check balances again
        await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
        await etherToken.balanceOf(policy.address).should.eventually.eq(180)
        await etherToken.balanceOf(entity.address).should.eventually.eq(1820 + 10)
        await etherToken.balanceOf(market.address).should.eventually.eq(0)
        await trancheToken.balanceOf(accounts[2]).should.eventually.eq(5)
        await trancheToken.balanceOf(entity.address).should.eventually.eq(0)
        await trancheToken.balanceOf(market.address).should.eventually.eq(95)
      })

      it('and tranche status is unchanged', async () => {
        // tranche status unchanged
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          state_: TRANCHE_STATE_SELLING,
        })
      })

      it('and tranche balance has been updated', async () => {
        const b = (await policy.getTrancheInfo(0)).balance_
        expect(b.toNumber()).to.eq(10 + calcPremiumsMinusCommissions({
          premiums: [1000],
          claimsAdminCommissionBP,
          brokerCommissionBP,
          naymsCommissionBP,
          underwriterCommissionBP,
        }))
      })

      it('and tally of shares sold has been updated', async () => {
        // check shares sold
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          sharesSold_: 5,
        })
      })

      it('and market offer is still active', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: marketOfferId,
        })
        await market.isActive(marketOfferId).should.eventually.eq(true)
      })
    })

    it('new token owners cannot trade their tokens whilst tranche is still selling', async () => {
      // get tranche tokens
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      // buy the tranche token
      await market.executeLimitOffer(etherToken.address, 10, trancheToken.address, 5, FEE_SCHEDULE_STANDARD, { from: accounts[2] })
      // check balance
      await trancheToken.balanceOf(accounts[2]).should.eventually.eq(5)
      // try trading the tranche token
      // await market.executeLimitOffer(trancheToken.address, 1, etherToken.address, 1, FEE_SCHEDULE_STANDARD, { from: accounts[2] }).should.be.rejectedWith('can only trade when policy is active')
    })

    describe('if a tranche fully sells out', () => {
      let txResult
      let trancheToken

      beforeEach(async () => {
        // make the offer on the market
        trancheToken = await getTrancheToken(0)

        // buy the whole tranche
        await etherToken.deposit({ from: accounts[2], value: 200 })
        await etherToken.approve(market.address, 200, { from: accounts[2] })
        txResult = await market.executeLimitOffer(etherToken.address, 200, trancheToken.address, 100, FEE_SCHEDULE_STANDARD, { from: accounts[2] })
      })

      it('emits tranche state updated event', async () => {
        const ev = extractEventArgs(txResult, events.TrancheStateUpdated)
        expect(ev.trancheIndex).to.eq('0')
        expect(ev.state).to.eq(TRANCHE_STATE_ACTIVE.toString())
      })

      it('then its status is set to active', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          state_: TRANCHE_STATE_ACTIVE,
        })
      })

      it('then tranche balance has been updated', async () => {
        const b = (await policy.getTrancheInfo(0)).balance_
        expect(b.toNumber()).to.eq(200 + calcPremiumsMinusCommissions({
          premiums: [1000],
          claimsAdminCommissionBP,
          brokerCommissionBP,
          naymsCommissionBP,
          underwriterCommissionBP,
        }))
      })

      it('and the tally of shares sold gets updated', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          sharesSold_: 100,
        })
      })

      it('and the market offer is closed', async () => {
        await policy.getTrancheInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: marketOfferId,
        })
        await market.isActive(marketOfferId).should.eventually.eq(false)
      })

      describe('tranche tokens support ERC-20 operations', () => {
        let tokenHolder
        
        beforeEach(async () => {
          tokenHolder = accounts[2]
        })

        it('but sending one\'s own tokens is not possible', async () => {
          await trancheToken.transfer(accounts[3], 1, { from: tokenHolder }).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('but approving an address to send on one\'s behalf is not possible', async () => {
          await trancheToken.approve(accounts[3], 1, { from: tokenHolder }).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('approving an address to send on one\'s behalf is possible if it is the market', async () => {
          await trancheToken.approve(market.address, 1, { from: tokenHolder }).should.be.fulfilled
        })

        describe('such as market sending tokens on one\'s behalf', () => {
          beforeEach(async () => {
            await settings.setAddress(settings.address, SETTINGS.MARKET, accounts[3]).should.be.fulfilled
          })

          it('but not when owner does not have enough', async () => {
            await trancheToken.transferFrom(tokenHolder, accounts[5], 100 + 1, { from: accounts[3] }).should.be.rejectedWith('not enough balance')
          })

          it('when the owner has enough', async () => {
            const result = await trancheToken.transferFrom(tokenHolder, accounts[5], 100, { from: accounts[3] })

            await trancheToken.balanceOf(tokenHolder).should.eventually.eq(0)
            await trancheToken.balanceOf(accounts[5]).should.eventually.eq(100)

            expect(extractEventArgs(result, events.Transfer)).to.include({
              from: tokenHolder,
              to: accounts[5],
              value: `${100}`,
            })
          })
        })
      })
    })
  })

  describe('sale gets ended', async () => {
    beforeEach(async () => {
      await approvePolicy()
    })

    it('but not if start date has not passed', async () => {
      await etherToken.deposit({ value: 100000 })
      await etherToken.approve(policy.address, 1000000)
      await policy.payTranchePremium(0, 1000)
      await policy.payTranchePremium(1, 1000)

      await evmClock.setAbsoluteTime(initiationDate)
      await policy.checkAndUpdateState()

      await policy.checkAndUpdateState()
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_INITIATED })
    })

    describe('once start date has passed', () => {
      let offerId0
      let offerId1

      beforeEach(async () => {
        // approve
        await etherToken.deposit({ value: 1000000 })
        await etherToken.approve(policy.address, 1000000)

        await policy.payTranchePremium(0, 2000)
        await policy.payTranchePremium(1, 2000)

        await evmClock.setAbsoluteTime(initiationDate)

        // kick-off the sale
        await policy.checkAndUpdateState()

        ;({ initialSaleOfferId_: offerId0 } = await policy.getTrancheInfo(0))
        ;({ initialSaleOfferId_: offerId1 } = await policy.getTrancheInfo(1))
        expect(offerId0).to.not.eq(0)
        expect(offerId1).to.not.eq(0)
      })

      it('unsold tranches have their market orders automatically cancelled', async () => {
        // heartbeat
        await evmClock.setAbsoluteTime(startDate)
        await policy.checkAndUpdateState()

        await policy.getTrancheInfo(0).should.eventually.matchObj({
          initialSaleOfferId_: offerId0,
        })
        await policy.getTrancheInfo(1).should.eventually.matchObj({
          initialSaleOfferId_: offerId1,
        })

        await market.isActive(offerId0).should.eventually.eq(false)
        await market.isActive(offerId1).should.eventually.eq(false)
      })

      it('cancelled tranches emit events', async () => {
        await evmClock.setAbsoluteTime(startDate)
        const ret = await policy.checkAndUpdateState()

        const evs = parseEvents(ret, events.TrancheStateUpdated)
        expect(evs.length).to.eq(2)

        const [ ev1, ev2 ] = evs

        expect(ev1.args.trancheIndex).to.eq('0')
        expect(ev1.args.state).to.eq(TRANCHE_STATE_CANCELLED.toString())

        expect(ev2.args.trancheIndex).to.eq('1')
        expect(ev2.args.state).to.eq(TRANCHE_STATE_CANCELLED.toString())
      })

      describe('even if none of the tranches are active the policy still gets made active', () => {
        it('and updates internal state', async () => {
          await evmClock.setAbsoluteTime(startDate)
          await policy.checkAndUpdateState()

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })

          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
        })

        it('and it emits an event', async () => {
          await evmClock.setAbsoluteTime(startDate)
          const result = await policy.checkAndUpdateState()

          const ev = extractEventArgs(result, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_ACTIVE.toString())
        })
      })

      describe('one of the tranches can be active but its premiums might not be up-to-date, in which case it gets cancelled', () => {
        beforeEach(async () => {
          const trancheToken = await getTrancheToken(0)

          // buy the whole tranche to make it active
          await etherToken.deposit({ from: accounts[2], value: 1000000 })
          await etherToken.approve(market.address, 200, { from: accounts[2] })
          await market.executeLimitOffer(etherToken.address, 200, trancheToken.address, 100, FEE_SCHEDULE_STANDARD, { from: accounts[2] })
        })

        it('and updates internal state', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          await policy.checkAndUpdateState()

          // now check
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
        })

        it('and it emits an event', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          const result = await policy.checkAndUpdateState()

          const evs = parseEvents(result, events.TrancheStateUpdated)
          expect(evs.length).to.eq(2)

          const evsStates = evs.map(e => e.args.state)
          expect(evsStates[0]).to.eq(TRANCHE_STATE_CANCELLED.toString())
          expect(evsStates[1]).to.eq(TRANCHE_STATE_CANCELLED.toString())
        })
      })

      describe('atleast one of the tranches can be active and its premiums can be up-to-date, in which case it stays active', () => {
        beforeEach(async () => {
          // make the offer on the market
          const trancheToken = await getTrancheToken(0)

          // buy the whole tranche to make it active
          await etherToken.deposit({ from: accounts[2], value: 1000000 })
          await etherToken.approve(market.address, 200, { from: accounts[2] })
          const ret = await market.executeLimitOffer(etherToken.address, 200, trancheToken.address, 100, FEE_SCHEDULE_STANDARD, { from: accounts[2] })

          const ev = extractEventArgs(ret, events.TrancheStateUpdated)
          expect(ev.trancheIndex).to.eq('0')
          expect(ev.state).to.eq(TRANCHE_STATE_ACTIVE.toString())

          // pay its premiums upto start date
          await etherToken.approve(policy.address, 1000000, { from: accounts[2] })
          let toPay = 0
          for (let i = 0; (startDate - initiationDate) / timeIntervalSeconds >= i; i += 1) {
            toPay += (2000 + 1000 * i)
          }
          await policy.payTranchePremium(0, toPay, { from: accounts[2] })
        })

        it('updates internal state', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          await policy.checkAndUpdateState()

          // now check
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_ACTIVE,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
        })

        it('emits an event', async () => {
          // end sale
          await evmClock.setAbsoluteTime(startDate)
          const result = await policy.checkAndUpdateState()

          const evs = parseEvents(result, events.TrancheStateUpdated)
          expect(evs.length).to.eq(1)

          const [ ev ] = evs
          expect(ev.args.state).to.eq(TRANCHE_STATE_CANCELLED.toString())
          expect(ev.args.trancheIndex).to.eq('1')
        })
      })

      it('once policy becomes active, then token owners can start trading', async () => {
        // make the offer on the market
        const trancheToken = await getTrancheToken(0)

        // buy the whole tranche to make it active
        await etherToken.deposit({ from: accounts[2], value: 2000000 })
        await etherToken.approve(market.address, 200, { from: accounts[2] })
        await market.executeLimitOffer(etherToken.address, 200, trancheToken.address, 100, FEE_SCHEDULE_STANDARD, { from: accounts[2] })
        // pay all premiums upto start date
        await etherToken.approve(policy.address, 1000000, { from: accounts[2] })
        let toPay = 0
        for (let i = 0; (startDate - initiationDate) / timeIntervalSeconds >= i; i += 1) {
          toPay += (2000 + 1000 * i)
        }
        await policy.payTranchePremium(0, toPay, { from: accounts[2] })

        // end sale
        await evmClock.setAbsoluteTime(startDate)
        await policy.checkAndUpdateState()

        // try trading
        await market.executeLimitOffer(trancheToken.address, 1, etherToken.address, 1, FEE_SCHEDULE_STANDARD, { from: accounts[2] }).should.be.fulfilled

        // check balance
        await trancheToken.balanceOf(accounts[2]).should.eventually.eq(99)
      })
    })
  })

  describe('if policy has been active for a while state can be checked again', async () => {
    let nextPremium

    beforeEach(async () => {
      await approvePolicy()

      // pay first premiums
      await etherToken.deposit({ value: 1000000 })
      await etherToken.approve(policy.address, 1000000)
      await policy.payTranchePremium(0, 1000)
      await policy.payTranchePremium(1, 1000)

      // pass the inititation date
      await evmClock.setAbsoluteTime(initiationDate)

      // start the sale
      await policy.checkAndUpdateState()

      // sell-out the tranches
      await etherToken.deposit({ value: 2000000, from: accounts[2] })
      await etherToken.approve(market.address, 2000000, { from: accounts[2] })

      const tranche0Address = ((await getTrancheToken(0))).address
      await market.executeLimitOffer(etherToken.address, 200, tranche0Address, 100, FEE_SCHEDULE_STANDARD, { from: accounts[2] })

      const tranche1Address = ((await getTrancheToken(1))).address
      await market.executeLimitOffer(etherToken.address, 100, tranche1Address, 50, FEE_SCHEDULE_STANDARD, { from: accounts[2] })

      // pay premiums upto start date
      let toPay = 0
      for (let i = 0; (startDate - initiationDate) / timeIntervalSeconds > i; i += 1) {
        nextPremium = (2000 + 1000 * i)
        toPay += nextPremium
      }
      await policy.payTranchePremium(0, toPay)
      await policy.payTranchePremium(1, toPay)
      nextPremium += 1000

      // pass the start date
      await evmClock.setAbsoluteTime(startDate)

      // end the sale
      await policy.checkAndUpdateState()

      // sanity check
      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTrancheInfo(0).should.eventually.matchObj({
        state_: TRANCHE_STATE_ACTIVE,
      })
      await policy.getTrancheInfo(1).should.eventually.matchObj({
        state_: TRANCHE_STATE_ACTIVE,
      })
    })

    it('and it remains active if all premium payments are up to date', async () => {
      await policy.payTranchePremium(0, nextPremium)
      await policy.payTranchePremium(1, nextPremium)

      await evmClock.moveTime(timeIntervalSeconds)
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTrancheInfo(0).should.eventually.matchObj({
        state_: TRANCHE_STATE_ACTIVE,
      })
      await policy.getTrancheInfo(1).should.eventually.matchObj({
        state_: TRANCHE_STATE_ACTIVE,
      })
    })

    it('and it still stays active if any tranche premium payments have been missed, though that tranche gets cancelled', async () => {
      await policy.payTranchePremium(0, nextPremium)
      // await policy.payTranchePremium(1) - deliberately miss this payment

      await evmClock.moveTime(timeIntervalSeconds)
      await policy.checkAndUpdateState()

      await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
      await policy.getTrancheInfo(0).should.eventually.matchObj({
        state_: TRANCHE_STATE_ACTIVE,
      })
      await policy.getTrancheInfo(1).should.eventually.matchObj({
        state_: TRANCHE_STATE_CANCELLED,
      })
    })

    describe('claims can be made', () => {
      beforeEach(async () => {
        await policy.payTranchePremium(0, nextPremium)
        await policy.payTranchePremium(1, nextPremium)

        await evmClock.moveTime(timeIntervalSeconds)
        await policy.checkAndUpdateState()
      })

      describe('and once made', () => {
        beforeEach(async () => {
          await policy.makeClaim(0, 1, { from: insuredPartyRep })
          await policy.makeClaim(0, 2, { from: insuredPartyRep })
          await policy.makeClaim(1, 4, { from: insuredPartyRep })
          await policy.makeClaim(1, 7, { from: insuredPartyRep })
        })

        it('they can then be approved or declined', async () => {
          await policy.declineClaim(0, { from: claimsAdminRep })
          await policy.makeClaim(0, 1, { from: insuredPartyRep })
          await policy.approveClaim(1, { from: claimsAdminRep })
        })
      })
    })

    describe('once maturation date has passed', () => {
      describe('if NOT all premium payments are up-to-date', () => {
        beforeEach(async () => {
          await policy.payTranchePremium(0, nextPremium)
          await policy.payTranchePremium(1, nextPremium)
        })

        it('marks some tranches as cancelled and tries to buys back all tranche tokens', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          const ret = await policy.checkAndUpdateState()

          const ev = extractEventArgs(ret, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_BUYBACK.toString())

          const evs = parseEvents(ret, events.TrancheStateUpdated)
          expect(evs.length).to.eq(2)
          expect(evs[0].args.trancheIndex).to.eq('0')
          expect(evs[0].args.state).to.eq(TRANCHE_STATE_CANCELLED.toString())
          expect(evs[1].args.trancheIndex).to.eq('1')
          expect(evs[1].args.state).to.eq(TRANCHE_STATE_CANCELLED.toString())

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
          await policy.getTrancheInfo(0).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTrancheInfo(1).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
        })

        describe('but if there are pending claims', () => {
          beforeEach(async () => {
            await policy.makeClaim(0, 1, { from: insuredPartyRep })
            await policy.makeClaim(0, 2, { from: insuredPartyRep })
          })

          it('it does not do the buyback until the claims get handled', async () => {
            await evmClock.setAbsoluteTime(maturationDate)
            const ret = await policy.checkAndUpdateState()

            const ev = extractEventArgs(ret, events.PolicyStateUpdated)
            expect(ev.state).to.eq(POLICY_STATE_MATURED.toString())
            const preEvs = parseEvents(ret, events.TrancheStateUpdated).filter(e => e.args.state === TRANCHE_STATE_CANCELLED.toString())
            expect(preEvs.length).to.eq(2)

            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })

            await policy.getTrancheInfo(0).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })

            await policy.declineClaim(0, { from: claimsAdminRep })
            await policy.approveClaim(1, { from: claimsAdminRep })

            const ret2 = await policy.checkAndUpdateState()
            const ev2 = extractEventArgs(ret2, events.PolicyStateUpdated)
            expect(ev2.state).to.eq(POLICY_STATE_BUYBACK.toString())
            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })
            const postEvs = parseEvents(ret2, events.TrancheStateUpdated)
            expect(postEvs.length).to.eq(0) // tranches are already cancelled, and so stay that way

            await policy.getTrancheInfo(0).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
          })
        })

        describe('but if the policy is not fully collateralized in the treasury', () => {
          beforeEach(async () => {
            await entityTreasuryTestFacet.setRealBalance(etherToken.address, 0)
          })

          it('it does not do the buyback until policy becomes collateralized again', async () => {
            await evmClock.setAbsoluteTime(maturationDate)
            const ret = await policy.checkAndUpdateState()

            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })

            await policy.getTrancheInfo(0).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })

            await entityTreasuryTestFacet.setRealBalance(etherToken.address, 100000)

            const ret2 = await policy.checkAndUpdateState()
            const ev2 = extractEventArgs(ret2, events.PolicyStateUpdated)
            expect(ev2.state).to.eq(POLICY_STATE_BUYBACK.toString())
            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })

            await policy.getTrancheInfo(0).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
          })
        })

        it('and subsequent calls have no effect', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()

          const { finalBuybackofferId_: offer1 } = await policy.getTrancheInfo(0)
          expect(offer1).to.not.eq(0)
          const { finalBuybackofferId_: offer2 } = await policy.getTrancheInfo(1)
          expect(offer2).to.not.eq(0)

          await policy.checkAndUpdateState()

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_CANCELLED,
          })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            finalBuybackofferId_: offer1,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            finalBuybackofferId_: offer2,
          })
        })

        it('and no more claims can be made', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()
          await policy.makeClaim(0, 1, { from: insuredPartyRep }).should.be.rejectedWith('must be in active state')
        })
      })

      describe('if all premium payments are up-to-date', () => {
        beforeEach(async () => {
          const t0 = await policy.getTranchePremiumsInfo(0)
          let nextPremiumAmount0 = t0.nextPremiumAmount_.toNumber()
          const numPremiums0 = t0.numPremiums_.toNumber()
          const numPremiumsPaid0 = t0.numPremiumsPaid_.toNumber()
          let toPay0 = 0
          for (let i = numPremiumsPaid0 + 1; numPremiums0 >= i; i += 1) {
            toPay0 += nextPremiumAmount0
            nextPremiumAmount0 += 1000
          }
          await policy.payTranchePremium(0, toPay0)

          const t1 = await policy.getTranchePremiumsInfo(1)
          let nextPremiumAmount1 = t1.nextPremiumAmount_.toNumber()
          const numPremiums1 = t1.numPremiums_.toNumber()
          const numPremiumsPaid1 = t1.numPremiumsPaid_.toNumber()
          let toPay1 = 0
          for (let i = numPremiumsPaid1 + 1; numPremiums1 >= i; i += 1) {
            toPay1 += nextPremiumAmount1
            nextPremiumAmount1 += 1000
          }
          await policy.payTranchePremium(1, toPay1)
        })

        it('tries to buys back all tranche tokens, and all tranches are matured', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          const ret = await policy.checkAndUpdateState()

          const ev = extractEventArgs(ret, events.PolicyStateUpdated)
          expect(ev.state).to.eq(POLICY_STATE_BUYBACK.toString())

          const tEvs = parseEvents(ret, events.TrancheStateUpdated).filter(e => e.args.state === TRANCHE_STATE_MATURED.toString())
          expect(tEvs.length).to.eq(2)

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_MATURED,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_MATURED,
          })
          await policy.getTrancheInfo(0).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
          await policy.getTrancheInfo(1).should.eventually.not.matchObj({
            finalBuybackofferId_: 0,
          })
        })

        describe('but if there are pending claims', () => {
          beforeEach(async () => {
            await policy.makeClaim(0, 1, { from: insuredPartyRep })
            await policy.makeClaim(0, 2, { from: insuredPartyRep })
          })

          it('it does not do the buyback until the claims get handled', async () => {
            await evmClock.setAbsoluteTime(maturationDate)
            const ret = await policy.checkAndUpdateState()

            const ev = extractEventArgs(ret, events.PolicyStateUpdated)
            expect(ev.state).to.eq(POLICY_STATE_MATURED.toString())

            const preEvs = parseEvents(ret, events.TrancheStateUpdated)
            expect(preEvs.length).to.eq(0)

            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
            await policy.getTrancheInfo(0).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })

            await policy.declineClaim(0, { from: claimsAdminRep })
            await policy.approveClaim(1, { from: claimsAdminRep })

            const ret2 = await policy.checkAndUpdateState()
            const ev2 = extractEventArgs(ret2, events.PolicyStateUpdated)
            expect(ev2.state).to.eq(POLICY_STATE_BUYBACK.toString())
            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })

            const postEvs = parseEvents(ret2, events.TrancheStateUpdated)
            expect(postEvs.length).to.eq(2)
            const postEvStates = postEvs.map(e => e.args.state)
            expect(postEvStates[0]).to.eq(TRANCHE_STATE_MATURED.toString())
            expect(postEvStates[1]).to.eq(TRANCHE_STATE_MATURED.toString())

            await policy.getTrancheInfo(0).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
          })
        })

        describe('but if the policy is not fully collateralized in the treasury', () => {
          beforeEach(async () => {
            await entityTreasuryTestFacet.setRealBalance(etherToken.address, 0)
          })

          it('it does not do the buyback until policy becomes collateralized again', async () => {
            await evmClock.setAbsoluteTime(maturationDate)
            const ret = await policy.checkAndUpdateState()

            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })

            await policy.getTrancheInfo(0).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.matchObj({
              finalBuybackofferId_: 0,
            })

            await entityTreasuryTestFacet.setRealBalance(etherToken.address, 100000)

            const ret2 = await policy.checkAndUpdateState()
            const ev2 = extractEventArgs(ret2, events.PolicyStateUpdated)
            expect(ev2.state).to.eq(POLICY_STATE_BUYBACK.toString())
            await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })

            await policy.getTrancheInfo(0).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
            await policy.getTrancheInfo(1).should.eventually.not.matchObj({
              finalBuybackofferId_: 0,
            })
          })
        })

        it('and subsequent calls have no effect', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()

          const { finalBuybackofferId_: offer1 } = await policy.getTrancheInfo(0)
          expect(offer1).to.not.eq(0)
          const { finalBuybackofferId_: offer2 } = await policy.getTrancheInfo(1)
          expect(offer2).to.not.eq(0)

          await policy.checkAndUpdateState()

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            state_: TRANCHE_STATE_MATURED,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            state_: TRANCHE_STATE_MATURED,
          })
          await policy.getTrancheInfo(0).should.eventually.matchObj({
            finalBuybackofferId_: offer1,
          })
          await policy.getTrancheInfo(1).should.eventually.matchObj({
            finalBuybackofferId_: offer2,
          })
        })

        it('and no more claims can be made', async () => {
          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()
          await policy.makeClaim(0, 1, { from: insuredPartyRep }).should.be.rejectedWith('must be in active state')
        })
      })

      describe('once it tries to buy back all tokens', async () => {
        beforeEach(async () => {
          const t0 = await policy.getTranchePremiumsInfo(0)     
          const numPremiums0 = t0.numPremiums_.toNumber()
          let numPremiumsPaid0 = t0.numPremiumsPaid_.toNumber()
          let nextPremiumAmount0 = t0.nextPremiumAmount_.toNumber()
          let toPay0 = 0
          for (let i = numPremiumsPaid0 + 1; numPremiums0 >= i; i += 1) {          
            toPay0 += nextPremiumAmount0
            nextPremiumAmount0 += 1000
          }
          await policy.payTranchePremium(0, toPay0)

          const t1 = await policy.getTranchePremiumsInfo(1)
          let nextPremiumAmount1 = t1.nextPremiumAmount_.toNumber()
          const numPremiums1 = t1.numPremiums_.toNumber()
          const numPremiumsPaid1 = t1.numPremiumsPaid_.toNumber()
          let toPay1 = 0
          for (let i = numPremiumsPaid1 + 1; numPremiums1 >= i; i += 1) {
            toPay1 += nextPremiumAmount1
            nextPremiumAmount1 += 1000  
          }
          await policy.payTranchePremium(1, toPay1)

          await evmClock.setAbsoluteTime(maturationDate)
          await policy.checkAndUpdateState()

          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })
        })

        it('the market offer uses the "platform action" fee schedule', async () => {
          const { finalBuybackofferId_: buybackOfferId } = await policy.getTrancheInfo(0)

          await market.getOffer(buybackOfferId).should.eventually.matchObj({
            feeSchedule_: FEE_SCHEDULE_PLATFORM_ACTION,
          })
        })

        it('other people can trade their previously purchased tranche tokens in for (hopefully) profit ', async () => {
          const trancheTkn = await getTrancheToken(0)

          const treasuryPreBalance = (await trancheTkn.balanceOf(entity.address)).toNumber()

          const preBalance = (await etherToken.balanceOf(accounts[2])).toNumber()

          const { finalBuybackofferId_: buybackOfferId } = await policy.getTrancheInfo(0)

          const tranche0Address = (await getTrancheToken(0)).address

          await market.executeMarketOffer(tranche0Address, 100, etherToken.address, { from: accounts[2] });

          // check that order has been fulfilled
          await market.isActive(buybackOfferId).should.eventually.eq(false)

          const postBalance = (await etherToken.balanceOf(accounts[2])).toNumber()

          const expectedPremiumBalance = calcPremiumsMinusCommissions({
            premiums: [1000, 2000, 3000, 4000, 5000, 6000, 7000],
            claimsAdminCommissionBP,
            brokerCommissionBP,
            naymsCommissionBP,
            underwriterCommissionBP,
          })

          expect(postBalance - preBalance).to.eq(200 + expectedPremiumBalance) /* 200 = initial sold amount */

          const treasuryPostBalance = (await trancheTkn.balanceOf(entity.address)).toNumber()

          expect(treasuryPostBalance - treasuryPreBalance).to.eq(100)
        })

        it('keeps track of when a tranche has been totally bought back', async () => {
          const trancheTkn = await getTrancheToken(0)

          await trancheTkn.balanceOf(entity.address).should.eventually.eq(0)

          const numShares = (await policy.getTrancheInfo(0)).numShares_.toNumber()
          
          expect((await policy.getTrancheInfo(0)).buybackCompleted_).to.eq(false)

          const { finalBuybackofferId_: buybackOfferId } = await policy.getTrancheInfo(0)

          const offer = await market.getOffer(buybackOfferId)

          await market.executeMarketOffer(trancheTkn.address, offer.buyAmount_, etherToken.address, { from: accounts[2] });

          await trancheTkn.balanceOf(entity.address).should.eventually.eq(numShares)
 
          expect((await policy.getTrancheInfo(0)).buybackCompleted_).to.eq(true)
        })

        it('sets policy to closed once all tranches have been fully bought back', async () => {
          // buyback tranche 0
          expect((await policy.getTrancheInfo(0)).buybackCompleted_).to.eq(false)

          const trancheTkn0 = await getTrancheToken(0)

          const { finalBuybackofferId_: buybackOfferId0 } = await policy.getTrancheInfo(0)

          const offer0 = await market.getOffer(buybackOfferId0)

          await market.executeMarketOffer(trancheTkn0.address, offer0.buyAmount_, etherToken.address, { from: accounts[2] });

          expect((await policy.getTrancheInfo(0)).buybackCompleted_).to.eq(true)

          // check: policy still in buyback state
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_BUYBACK })

          // buyback tranche 1
          expect((await policy.getTrancheInfo(1)).buybackCompleted_).to.eq(false)

          const trancheTkn1 = await getTrancheToken(1)

          const { finalBuybackofferId_: buybackOfferId1 } = await policy.getTrancheInfo(1)

          const offer1 = await market.getOffer(buybackOfferId1)

          await market.executeMarketOffer(trancheTkn1.address, offer1.buyAmount_, etherToken.address, { from: accounts[2] });

          expect((await policy.getTrancheInfo(1)).buybackCompleted_).to.eq(true)

          // check: policy now closed
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CLOSED })
        })
      })
    })
  })
})

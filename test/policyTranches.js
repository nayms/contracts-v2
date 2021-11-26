import _ from 'lodash'
import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranche,
  preSetupPolicy,
  createEntity,
  EvmSnapshot,
  doPolicyApproval,
} from './utils'
import { events } from '..'
import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../deploy/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../deploy/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../deploy/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../deploy/modules/policyImplementations'
import { getAccounts } from '../deploy/utils'

const IERC20 = artifacts.require("./base/IERC20")
const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const DummyToken = artifacts.require("./DummyToken")
const IPolicy = artifacts.require("./base/IPolicy")
const DummyPolicyFacet = artifacts.require("./test/DummyPolicyFacet")
const TrancheToken = artifacts.require("./TrancheToken")
const FreezeUpgradesFacet = artifacts.require("./test/FreezeUpgradesFacet")



describe('Policy: Tranches', () => {
  const evmSnapshot = new EvmSnapshot()

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

  let TRANCHE_STATE_CANCELLED
  let TRANCHE_STATE_ACTIVE
  let TRANCHE_STATE_MATURED

  let POLICY_ATTRS_1
  let POLICY_ATTRS_2
  let POLICY_ATTRS_3
  let POLICY_ATTRS_4

  let setupPolicy
  const policies = new Map()

  before(async () => {
    accounts = await getAccounts()
    entityAdminAddress = accounts[1]
    entityManagerAddress = accounts[2]
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

    // entity
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings, entityDeployer })

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)

    const entityAddress = await createEntity({ entityDeployer, adminAddress: entityAdminAddress })

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // roles
    underwriter = await createEntity({ entityDeployer, adminAddress: underwriterRep, entityContext, acl })
    insuredParty = await createEntity({ entityDeployer, adminAddress: insuredPartyRep })
    broker = await createEntity({ entityDeployer, adminAddress: brokerRep })
    claimsAdmin = await createEntity({ entityDeployer, adminAddress: claimsAdminRep })

    POLICY_ATTRS_1 = {
      initiationDateDiff: 1000,
      startDateDiff: 2000,
      maturationDateDiff: 3000,
      claimsAdminCommissionBP: 0,
      brokerCommissionBP: 0,
      naymsCommissionBP: 0,
      underwriter, insuredParty, broker, claimsAdmin,
    }

    POLICY_ATTRS_2 = Object.assign({}, POLICY_ATTRS_1, {
      initiationDateDiff: 0,
    })

    POLICY_ATTRS_3 = Object.assign({}, POLICY_ATTRS_1, {
      initiationDateDiff: 0,
      startDateDiff: 0,
      maturationDateDiff: 30,
    })

    POLICY_ATTRS_4 = Object.assign({}, POLICY_ATTRS_1, {
      trancheDataDiff: [[100, 2, 0, 5, 30, 6]]
    })

    // policy
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER)

    ;({ facets: [ policyCoreAddress ] } = await ensurePolicyImplementationsAreDeployed({ artifacts, settings }))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_CANCELLED = await policyStates.POLICY_STATE_CANCELLED()
    POLICY_STATE_IN_APPROVAL = await policyStates.POLICY_STATE_IN_APPROVAL()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()
    
    TRANCHE_STATE_CANCELLED = await policyStates.TRANCHE_STATE_CANCELLED()
    TRANCHE_STATE_ACTIVE = await policyStates.TRANCHE_STATE_ACTIVE()
    TRANCHE_STATE_MATURED = await policyStates.TRANCHE_STATE_MATURED()

    const preSetupPolicyCtx = { policies, settings, events, etherToken, entity, entityManagerAddress }
    await Promise.all([
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_1),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_2),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_3),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_4),
    ])

    setupPolicy = async arg => {
      const { attrs, policyAddress } = policies.get(arg)

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicy.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress

      return attrs
    }
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('tranches', () => {
    describe('basic tests', () => {
      it('cannot be created without correct authorization', async () => {
        await setupPolicy(POLICY_ATTRS_1)
        await createTranche(policy, {}).should.be.rejectedWith('must be policy owner or original creator')
      })

      it('all basic values must be valid', async () => {
        await setupPolicy(POLICY_ATTRS_1)
        await createTranche(policy, { numShares: 0 }, { from: policyOwnerAddress }).should.be.rejectedWith('invalid num of shares')
        await createTranche(policy, { pricePerShareAmount: 0 }, { from: policyOwnerAddress }).should.be.rejectedWith('invalid price')
      })

      it('create tranches as part of policy creation call', async () => {
        await setupPolicy(POLICY_ATTRS_4)

        await policy.getInfo().should.eventually.matchObj({
          numTranches_: 1,
        })

        await policy.getTrancheInfo(0).should.eventually.matchObj({
          numShares_: 100,
          initialPricePerShare_: 2
        })

        await policy.getTranchePremiumsInfo(0).should.eventually.matchObj({
          numPremiums_: 2,
          nextPremiumAmount_: 5,
        })
      })

      describe('premiums and tranche data must be valid', () => {
          // Premiums must:
          // - be specified in increasing order
          // - be after initiation date
          // - be before maturation date
        beforeEach(async () => {
         await setupPolicy(POLICY_ATTRS_3)
        })

        it('must only accept valid premiums and tranche data', async () => {

          // 1 - create first tranche with no premiums
          await createTranche(policy, { 
            numShares: 1,
            pricePerShareAmount: 10,
            premiumsDiff: []
          }, { from: policyOwnerAddress }).should.be.fulfilled

          await policy.getInfo().should.eventually.matchObj({
            numTranches_: 1,
          }, '1 - should have 1 tranche')

          await policy.getTrancheInfo(0).should.eventually.matchObj({
            numShares_: 1,
            initialPricePerShare_: 10
          }, '1 - tranche data should match')

          await policy.getTranchePremiumsInfo(0).should.eventually.matchObj({
            numPremiums_: 0,
            nextPremiumAmount_: 0,
          }, '1 - should have 0 premiums')

          // 2 - Create second tranche with 1 premium
          await createTranche(policy, { 
            numShares: 2,
            pricePerShareAmount: 11,
            premiumsDiff: [0, 3]
          }, { from: policyOwnerAddress }).should.be.fulfilled

          await policy.getInfo().should.eventually.matchObj({
            numTranches_: 2,
          }, '2 - should have 2 tranches')

          await policy.getTrancheInfo(1).should.eventually.matchObj({
            numShares_: 2,
            initialPricePerShare_: 11
          }, '2 - tranche data should match')

          await policy.getTranchePremiumsInfo(1).should.eventually.matchObj({
            numPremiums_: 1,
            nextPremiumAmount_: 3,
          }, '2 - should have 1 premium')

          // 3 - create third tranche with 4 premiums
          // the first is on the initiation date
          //the last is on the maturation date
          await createTranche(policy, { 
            numShares: 1000000000,
            pricePerShareAmount: 7,
            premiumsDiff: [0, 1, 10, 2, 20, 3, 30, 4]
          }, { from: policyOwnerAddress }).should.be.fulfilled

          await policy.getInfo().should.eventually.matchObj({
            numTranches_: 3,
          }, '3 - should have 3 tranches')

          await policy.getTrancheInfo(2).should.eventually.matchObj({
            numShares_: 1000000000,
            initialPricePerShare_: 7
          }, '3 - tranche data should match')

          await policy.getTranchePremiumsInfo(2).should.eventually.matchObj({
            numPremiums_: 4,
            nextPremiumAmount_: 1,
          }, '3 - should have 4 premiums')

          // 4 - try to create fourth tranche with invalid premiums

          // premium past maturation
          await createTranche(policy,           { 
            numShares: 1000000000,
            pricePerShareAmount: 7,
            premiumsDiff: [0, 1, 10, 2, 20, 3, 30, 4, 40, 5]
          }, 
          { from: policyOwnerAddress }).should.be.rejectedWith('premium after maturation')

          // premiums not in order
          await createTranche(policy,           { 
            numShares: 1000000000,
            pricePerShareAmount: 7,
            premiumsDiff: [0, 1, 20, 2, 10, 3, 30, 4, 40, 5]
          }, 
          { from: policyOwnerAddress }).should.be.rejectedWith('premiums not in increasing order')

          // premiums before initiation
          await createTranche(policy,           { 
            numShares: 1000000000,
            pricePerShareAmount: 7,
            premiumsDiff: [-10, 1, 20, 2, 10, 3, 30, 4, 40, 5]
          }, 
          { from: policyOwnerAddress }).should.be.rejectedWith('premium before initiation')

          await policy.getInfo().should.eventually.matchObj({
            numTranches_: 3,
          }, '4 - Should still have 3 tranches')

          await policy.getTrancheInfo(1).should.eventually.matchObj({
            numShares_: 2,
            initialPricePerShare_: 11
          }, '4 - tranche data on tranche-2 should not be altered')

          // 5 - Zero value premiums should be ignored
          await createTranche(policy, { 
            numShares: 1000000001,
            pricePerShareAmount: 4,
            premiumsDiff: [0, 0, 0, 0, 0, 0, 0, 1, 10, 2, 20, 0, 20, 3, 30, 4]
          }, { from: policyOwnerAddress }).should.be.fulfilled

          await policy.getInfo().should.eventually.matchObj({
            numTranches_: 4,
          }, '5 - should have 4 tranches')

          await policy.getTrancheInfo(3).should.eventually.matchObj({
            numShares_: 1000000001,
            initialPricePerShare_: 4
          }, '5 - tranche data should match')

          await policy.getTranchePremiumsInfo(3).should.eventually.matchObj({
            numPremiums_: 4,
            nextPremiumAmount_: 1,
          }, '5 - Should have 4 premiums')
        })
      })

      it('can be created and has initial supply allocated to treasury', async () => {
        await setupPolicy(POLICY_ATTRS_1)

        const result = await createTranche(policy, {
          numShares: 10,
          pricePerShareAmount: 100,
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        const [log] = parseEvents(result, events.CreateTranche)

        const { token_: addr } = await policy.getTrancheInfo(0)
        expect(addr.length).to.eq(42)

        expect(log.args.index).to.eq('0')

        await policy.getInfo().should.eventually.matchObj({ numTranches_: 1 })
      })

      it('can be created and will have state set to CREATED', async () => {
        await setupPolicy(POLICY_ATTRS_1)

        await createTranche(policy, {
          numShares: 10,
          pricePerShareAmount: 100,
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        await policy.getTrancheInfo(0).should.eventually.matchObj({
          state_: POLICY_STATE_CREATED
        })
      })

      it('can be created more than once', async () => {
        await setupPolicy(POLICY_ATTRS_1)

        await createTranche(policy, {
          numShares: 10,
          pricePerShareAmount: 100,
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        await createTranche(policy, {
          numShares: 11,
          pricePerShareAmount: 100 + 2,
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        await policy.getInfo().should.eventually.matchObj({ numTranches_: 2 })

        const addresses = {}

        await Promise.all(_.range(0, 2).map(async i => {
          const { token_: addr } = await policy.getTrancheInfo(i)
          expect(!addresses[addr]).to.be.true
          expect(addr.length).to.eq(42)
          addresses[addr] = true
        }))

        expect(Object.keys(addresses).length).to.eq(2)
      })

      it('cannot be created once in approval state', async () => {
        await setupPolicy(POLICY_ATTRS_2)
        await policy.approve(ROLES.PENDING_BROKER, { from: brokerRep })
        await createTranche(policy, {}, { from: accounts[2] }).should.be.rejectedWith('must be in created state')
      })

      it('cannot be created once in approved state', async () => {
        await setupPolicy(POLICY_ATTRS_2)
        await doPolicyApproval({ policy, brokerRep, underwriterRep, claimsAdminRep, insuredPartyRep })
        await createTranche(policy, {}, { from: accounts[2] }).should.be.rejectedWith('must be in created state')
      })
    })

    describe('are ERC20 tokens', () => {
      let tokens

      beforeEach(async () => {
        await setupPolicy(POLICY_ATTRS_1)

        acl.assignRole(policyContext, accounts[0], ROLES.POLICY_OWNER)

        await createTranche(policy, {
          numShares: 10,
          pricePerShareAmount: 100,
        }).should.be.fulfilled

        await createTranche(policy, {
          numShares: 10,
          pricePerShareAmount: 100,
        }).should.be.fulfilled
      })


      it('which have basic details', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC20.at((await policy.getTrancheInfo(i)).token_)

          const NAME = `NAYMS-${policyProxy.address.toLowerCase()}-TRANCHE-${i + 1}`
          const SYMBOL = `N-${policyProxy.address.toLowerCase().substr(0, 6)}-${i + 1}`

          await tkn.name().should.eventually.eq(NAME)
          await tkn.symbol().should.eventually.eq(SYMBOL)
          await tkn.totalSupply().should.eventually.eq(10)
          await tkn.decimals().should.eventually.eq(18)
          await tkn.allowance(accounts[0], accounts[1]).should.eventually.eq(0)

          done++
        }))

        expect(done).to.eq(2)
      })

      it('which have all supply initially allocated to the treasury', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC20.at((await policy.getTrancheInfo(i)).token_)

          await tkn.balanceOf(entity.address).should.eventually.eq(await tkn.totalSupply())

          done++
        }))

        expect(done).to.eq(2)
      })
    })
  })
})

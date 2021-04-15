import { keccak256 } from './utils/web3'

import {
  EvmSnapshot,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  BYTES32_ZERO,
  createEntity,
  createPolicy,
  createTranch,
} from './utils'

import { events } from '..'
import { ROLES, SETTINGS } from '../utils/constants'
import { ensureEtherTokenIsDeployed, deployNewEtherToken } from '../migrations/modules/etherToken'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IEntity = artifacts.require("./base/IEntity")
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const AccessControl = artifacts.require('./base/AccessControl')
const DummyEntityFacet = artifacts.require("./test/DummyEntityFacet")
const EntityTreasuryTestFacet = artifacts.require("./test/EntityTreasuryTestFacet")
const IEntityTreasuryTestFacet = artifacts.require("./test/IEntityTreasuryTestFacet")
const PolicyTreasuryTestFacet = artifacts.require("./test/PolicyTreasuryTestFacet")
const IPolicyTreasuryTestFacet = artifacts.require("./test/IPolicyTreasuryTestFacet")
const EntityTreasuryFacet = artifacts.require("./test/EntityTreasuryFacet")
const IPolicyTreasury = artifacts.require("./base/IPolicyTreasury")
const IPolicyTreasuryConstants = artifacts.require("./base/IPolicyTreasuryConstants")
const FreezeUpgradesFacet = artifacts.require("./test/FreezeUpgradesFacet")
const Entity = artifacts.require("./Entity")
const IPolicy = artifacts.require("./IPolicy")
const Policy = artifacts.require("./Policy")

contract('Treasury', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let settings
  let etherToken
  let etherToken2
  let market
  let systemContext
  let entityDeployer
  let entityProxy
  let entity
  let entityCoreAddress
  let entityContext

  const entityAdminAddress = accounts[0]

  let entityAdmin
  
  let treasury
  
  let policies

  let entityTreasuryTestFacet

  let DOES_NOT_HAVE_ROLE
  let HAS_ROLE_CONTEXT

  let ORDER_TYPE_TOKEN_BUYBACK
  let ORDER_TYPE_TOKEN_SALE

  before(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    market = await ensureMarketIsDeployed({ artifacts, settings })
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    etherToken = await ensureEtherTokenIsDeployed({ artifacts, settings })
    etherToken2 = await deployNewEtherToken({ artifacts, settings })
    await ensurePolicyImplementationsAreDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings })

    DOES_NOT_HAVE_ROLE = (await acl.DOES_NOT_HAVE_ROLE()).toNumber()
    HAS_ROLE_CONTEXT = (await acl.HAS_ROLE_CONTEXT()).toNumber()

    systemContext = await acl.systemContext()

    // deploy treasury entity test facets
    // const entityTreasuryTestFacetImpl = await EntityTreasuryTestFacet.new()
    // const entityAddrs = await settings.getAddresses(settings.address, SETTINGS.ENTITY_IMPL)
    // await settings.setAddresses(settings.address, SETTINGS.ENTITY_IMPL, entityAddrs.concat(entityTreasuryTestFacetImpl.address))
    // deploy treasury policy test facets
    const policyTreasuryTestFacetImpl = await PolicyTreasuryTestFacet.new(settings.address)
    const policyAddrs = await settings.getAddresses(settings.address, SETTINGS.POLICY_IMPL)
    await settings.setAddresses(settings.address, SETTINGS.POLICY_IMPL, policyAddrs.concat(policyTreasuryTestFacetImpl.address))

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)

    // entity
    const entityAddress = await createEntity({ entityDeployer, adminAddress: entityAdminAddress })
    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityProxy.address)
    entityContext = await entityProxy.aclContext()

    // policy
    policies = []
    for (let i = 0; 3 > i; i += 1) {
      await createPolicy(entity, { unit: (i < 2 ? etherToken.address : etherToken2.address) })
      const policyAddress = await entity.getPolicy(i)
      const proxy = await Policy.at(policyAddress)
      policies.push({
        address: policyAddress,
        policy: await IPolicy.at(policyAddress),
        context: await proxy.aclContext(),
        proxy,
        testFacet: await IPolicyTreasuryTestFacet.at(policyAddress),
      })
    }

    // test facets
    entityTreasuryTestFacet = await IEntityTreasuryTestFacet.at(entity.address)

    // treasury
    treasury = await IPolicyTreasury.at(entityProxy.address)

    // constants
    const cons = await EntityTreasuryFacet.new(settings.address)
    ORDER_TYPE_TOKEN_BUYBACK = await cons.ORDER_TYPE_TOKEN_BUYBACK()
    ORDER_TYPE_TOKEN_SALE = await cons.ORDER_TYPE_TOKEN_SALE()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('can be deployed', async () => {
    expect(entityProxy.address).to.exist
  })

  describe('can have policy balance updated', async () => {
    it('but not for a non-policy', async () => {
      await treasury.incPolicyBalance(0, { from: accounts[0] }).should.be.rejectedWith('not my policy')
    })

    it('for a policy', async () => {
      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
        balance_: 0,
        minBalance_: 0,
      })

      const ret = await policies[0].testFacet.treasuryIncPolicyBalance(123)

      expect(extractEventArgs(ret, events.UpdatePolicyBalance)).to.include({
        policy: policies[0].address,
        newBal: '123',
      })

      await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
        balance_: 123,
        minBalance_: 0,
      })

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 123,
        virtualBalance_: 123,
      })
    })

    it('when multiple policies deposit', async () => {
      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await treasury.getEconomics(etherToken2.address).should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await policies[0].testFacet.treasuryIncPolicyBalance(12)
      await policies[0].testFacet.treasuryIncPolicyBalance(7)
      await policies[1].testFacet.treasuryIncPolicyBalance(8)
      await policies[2].testFacet.treasuryIncPolicyBalance(5)

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 27,
        virtualBalance_: 27,
      })

      await treasury.getEconomics(etherToken2.address).should.eventually.matchObj({
        realBalance_: 5,
        virtualBalance_: 5,
      })
    })
  })

  describe('can have min policy balance set', async () => {
    it('but not for a non-policy', async () => {
      await treasury.setMinPolicyBalance(0, { from: accounts[0] }).should.be.rejectedWith('not my policy')
    })

    it('for a policy', async () => {
      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
        balance_: 0,
        minBalance_: 0,
      })

      const ret = await policies[0].testFacet.treasurySetMinPolicyBalance(123)

      expect(extractEventArgs(ret, events.SetMinPolicyBalance)).to.include({
        policy: policies[0].address,
        bal: '123',
      })

      await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
        balance_: 0,
        minBalance_: 123,
      })

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })
    })

    it('only once', async () => {
      await policies[0].testFacet.treasurySetMinPolicyBalance(123)
      await policies[0].testFacet.treasurySetMinPolicyBalance(123).should.be.rejectedWith('already set')
    })
  })

  describe('can pay claims', () => {
    beforeEach(async () => {
      await etherToken.deposit({ value: 100 })
      await etherToken.transfer(treasury.address, 100)
    })

    it('but not for a non-policy', async () => {
      await treasury.payClaim(accounts[0], 1).should.be.rejectedWith('not my policy')
    })

    it('for a policy, if policy balance is enough', async () => {
      await policies[0].testFacet.treasuryIncPolicyBalance(123)

      await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
        balance_: 123,
        minBalance_: 0,
      })

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 123,
        virtualBalance_: 123,
      })

      const ret = await policies[0].testFacet.treasuryPayClaim(accounts[5], 5)
      
      expect(extractEventArgs(ret, events.UpdatePolicyBalance)).to.include({
        policy: policies[0].address,
        newBal: '118',
      })

      await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
        balance_: 118,
        minBalance_: 0,
      })

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 118,
        virtualBalance_: 118,
      })

      await etherToken.balanceOf(accounts[5]).should.eventually.eq(5)
    })

    describe('for two policies, if policy balances are not enough', () => {
      beforeEach(async () => {
        await policies[0].testFacet.treasuryIncPolicyBalance(2)
        await policies[1].testFacet.treasuryIncPolicyBalance(3)
      })

      it('and aggregate balances are not enough for either', async () => {
        await policies[0].testFacet.treasuryPayClaim(accounts[5], 6)
        await policies[1].testFacet.treasuryPayClaim(accounts[4], 9)

        await treasury.getClaims(etherToken.address).should.eventually.matchObj({
          count_: 2,
          unpaidCount_: 2,
          unpaidTotalAmount_: 15,
        })

        await treasury.getClaim(etherToken.address, 1).should.eventually.matchObj({
          policy_: policies[0].address,
          recipient_: accounts[5],
          amount_: 6,
          paid_: false,
        })

        await treasury.getClaim(etherToken.address, 2).should.eventually.matchObj({
          policy_: policies[1].address,
          recipient_: accounts[4],
          amount_: 9,
          paid_: false,
        })

        await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
          balance_: 2,
          minBalance_: 0,
        })

        await treasury.getPolicyEconomics(policies[1].address).should.eventually.matchObj({
          balance_: 3,
          minBalance_: 0,
        })

        await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
          realBalance_: 5,
          virtualBalance_: 5,
        })
      })

      it('and aggregate balances are enough for 1, so it adds the other to pending claims', async () => {
        await policies[0].testFacet.treasuryPayClaim(accounts[5], 5)
        await policies[1].testFacet.treasuryPayClaim(accounts[4], 9)

        await treasury.getClaims(etherToken.address).should.eventually.matchObj({
          count_: 1,
          unpaidCount_: 1,
          unpaidTotalAmount_: 9,
        })

        await treasury.getClaim(etherToken.address, 1).should.eventually.matchObj({
          policy_: policies[1].address,
          recipient_: accounts[4],
          amount_: 9,
          paid_: false,
        })

        await treasury.getPolicyEconomics(policies[0].address).should.eventually.matchObj({
          balance_: 0,
        })

        await treasury.getPolicyEconomics(policies[1].address).should.eventually.matchObj({
          balance_: 3,
        })

        await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
          realBalance_: 0,
          virtualBalance_: 3,
        })

        await etherToken.balanceOf(accounts[5]).should.eventually.eq(5)
        await etherToken.balanceOf(accounts[4]).should.eventually.eq(0)
      })
    })
  })

  describe.only('can send funds to the entity and back', () => {
    beforeEach(async () => {
      await etherToken.deposit({ value: 2000 });
      await etherToken.approve(entity.address, 2000);
    })

    it('from entity to treasury when funds are enough', async () => {
      await entity.deposit(etherToken.address, 123);

      await entity.getBalance(etherToken.address).should.eventually.eq(123)

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await entity.transferToTreasury(etherToken.address, 123);

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 123,
        virtualBalance_: 0,
      })

      await entity.getBalance(etherToken.address).should.eventually.eq(0)
    })

    it('from entity to treasury when funds are NOT enough', async () => {
      await entity.deposit(etherToken.address, 123);
      await entity.transferToTreasury(etherToken.address, 124).should.be.rejectedWith('exceeds entity balance');
    })

    it('from treasury to entity when funds are enough', async () => {
      await policies[0].testFacet.treasuryIncPolicyBalance(2)
      await policies[1].testFacet.treasuryIncPolicyBalance(3)

      await entity.getBalance(etherToken.address).should.eventually.eq(0)

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 5,
        virtualBalance_: 5,
      })

      await entity.transferFromTreasury(etherToken.address, 5)

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 5,
      })

      await entity.getBalance(etherToken.address).should.eventually.eq(5)
    })

    it('from treasury to entity when funds are NOT enough', async () => {
      await policies[0].testFacet.treasuryIncPolicyBalance(2)
      await policies[1].testFacet.treasuryIncPolicyBalance(3)

      await entity.getBalance(etherToken.address).should.eventually.eq(0)

      await treasury.getEconomics(etherToken.address).should.eventually.matchObj({
        realBalance_: 5,
        virtualBalance_: 5,
      })

      await entity.transferFromTreasury(etherToken.address, 6).should.be.rejectedWith('exceeds treasury balance')
    })
  })

  describe('can trade', () => {
    beforeEach(async () => {
      await etherToken.deposit({ value: 500 })
      await etherToken.transfer(treasury.address, 500)
    })

    it('but not for a non-policy', async () => {
      await treasury.createOrder(
        ORDER_TYPE_TOKEN_SALE,
        etherToken.address,
        1,
        etherToken2.address,
        1,
      ).should.be.rejectedWith('not my policy')

      await treasury.cancelOrder(0).should.be.rejectedWith('not my policy')
    })

    it('for a policy', async () => {
      await policies[0].testFacet.treasuryCreateOrder(
        ORDER_TYPE_TOKEN_SALE,
        etherToken.address,
        1,
        etherToken2.address,
        5,
      )

      const offerId = (await market.last_offer_id()).toNumber()
      await market.isActive(offerId).should.eventually.eq(true)
      const offer = await market.getOffer(offerId)

      expect(offer[0].toNumber()).to.eq(1)
      expect(offer[1]).to.eq(etherToken.address)
      expect(offer[2].toNumber()).to.eq(5)
      expect(offer[3]).to.eq(etherToken2.address)

      await policies[0].testFacet.treasuryCancelOrder(offerId)

      await market.isActive(offerId).should.eventually.eq(false)
    })
  })
})
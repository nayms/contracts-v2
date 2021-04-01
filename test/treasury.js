import { keccak256 } from './utils/web3'

import {
  EvmSnapshot,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  BYTES32_ZERO,
  createPolicy,
  createTranch,
} from './utils'

import { events } from '..'
import { ROLES, SETTINGS } from '../utils/constants'
import { ensureEtherTokenIsDeployed, deployNewEtherToken } from '../migrations/modules/etherToken'
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

contract('Treasury', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let settings
  let etherToken
  let etherToken2
  let market
  let entityProxy
  let entity
  let entityCoreAddress
  let entityContext

  let entityAdmin

  let testFacet
  let treasury
  let dummyPolicy

  let DOES_NOT_HAVE_ROLE
  let HAS_ROLE_CONTEXT

  let ORDER_TYPE_TOKEN_BUYBACK
  let ORDER_TYPE_TOKEN_SALE

  before(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    market = await ensureMarketIsDeployed({ artifacts, settings })
    etherToken = await ensureEtherTokenIsDeployed({ artifacts, settings })
    etherToken2 = await deployNewEtherToken({ artifacts, settings })
    await ensurePolicyImplementationsAreDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings })

    DOES_NOT_HAVE_ROLE = (await acl.DOES_NOT_HAVE_ROLE()).toNumber()
    HAS_ROLE_CONTEXT = (await acl.HAS_ROLE_CONTEXT()).toNumber()

    entityAdmin = accounts[9]

    // deploy treasury entity test facets
    const entityTreasuryTestFacetImpl = await EntityTreasuryTestFacet.new()
    const entityAddrs = await settings.getAddresses(settings.address, SETTINGS.ENTITY_IMPL)
    await settings.setAddresses(settings.address, SETTINGS.ENTITY_IMPL, entityAddrs.concat(entityTreasuryTestFacetImpl.address))
    // deploy treasury policy test facets
    const policyTreasuryTestFacetImpl = await PolicyTreasuryTestFacet.new(settings.address)
    const policyAddrs = await settings.getAddresses(settings.address, SETTINGS.ENTITY_IMPL)
    await settings.setAddresses(settings.address, SETTINGS.POLICY_IMPL, policyAddrs.concat(policyTreasuryTestFacetImpl.address))

    entityProxy = await Entity.new(settings.address, entityAdmin, BYTES32_ZERO)
    // now let's speak to Entity contract using EntityImpl ABI
    entity = await IEntity.at(entityProxy.address)
    entityContext = await entityProxy.aclContext()

    treasury = await IPolicyTreasury.at(entityProxy.address)
    
    // set one of my accounts as a dummy policy
    dummyPolicy = accounts[9]
    testFacet = await IEntityTreasuryTestFacet.at(entityProxy.address)
    await testFacet.setAsMyPolicy(dummyPolicy)

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
      await treasury.getEconomics().should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await treasury.getPolicyEconomics(dummyPolicy).should.eventually.matchObj({
        balance_: 0,
        minBalance_: 0,
      })

      const ret = await treasury.incPolicyBalance(123, { from: dummyPolicy })

      expect(extractEventArgs(ret, events.UpdatePolicyBalance)).to.include({
        policy: dummyPolicy,
        amount: '123',
        newBal: '123',
      })

      await treasury.getPolicyEconomics(dummyPolicy).should.eventually.matchObj({
        balance_: 123,
        minBalance_: 0,
      })

      await treasury.getEconomics().should.eventually.matchObj({
        realBalance_: 123,
        virtualBalance_: 123,
      })
    })
  })

  describe('can have min policy balance set', async () => {
    it('but not for a non-policy', async () => {
      await treasury.setMinPolicyBalance(0, { from: accounts[0] }).should.be.rejectedWith('not my policy')
    })

    it('for a policy', async () => {
      await treasury.getEconomics().should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await treasury.getPolicyEconomics(dummyPolicy).should.eventually.matchObj({
        balance_: 0,
        minBalance_: 0,
      })

      const ret = await treasury.setMinPolicyBalance(123, { from: dummyPolicy })

      expect(extractEventArgs(ret, events.SetMinPolicyBalance)).to.include({
        policy: dummyPolicy,
        bal: '123',
      })

      await treasury.getPolicyEconomics(dummyPolicy).should.eventually.matchObj({
        balance_: 0,
        minBalance_: 123,
      })

      await treasury.getEconomics().should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })
    })

    it('only once', async () => {
      await treasury.setMinPolicyBalance(123, { from: dummyPolicy })
      await treasury.setMinPolicyBalance(123, { from: dummyPolicy }).should.be.rejectedWith('already set')
    })
  })

  describe('keeps track of its global economics', () => {
    beforeEach(async () => {
      await testFacet.setAsMyPolicy(accounts[7])
      await testFacet.setAsMyPolicy(accounts[8])
    })

    it('when multiple policies deposit', async () => {
      await treasury.getEconomics().should.eventually.matchObj({
        realBalance_: 0,
        virtualBalance_: 0,
      })

      await treasury.incPolicyBalance(12, { from: accounts[7 ]})
      await treasury.incPolicyBalance(15, { from: accounts[7] })
      await treasury.incPolicyBalance(3, { from: accounts[8] })

      await treasury.getEconomics().should.eventually.matchObj({
        realBalance_: 30,
        virtualBalance_: 30,
      })
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
    })

    it('for a policy', async () => {
      const orderId = await treasury.createOrder(
        ORDER_TYPE_TOKEN_SALE,
        etherToken.address,
        1,
        etherToken2.address,
        5,
        { from: dummyPolicy }
      )

      const offerId = await market.last_offer_id()
      await market.isActive(offerId).should.eventually.eq(true)
      const offer = await market.getOffer(offerId)

      expect(offer[0].toNumber()).to.eq(1)
      expect(offer[1]).to.eq(etherToken.address)
      expect(offer[2].toNumber()).to.eq(5)
      expect(offer[3]).to.eq(etherToken2.address)
    })

    it('and cancel a trade', async () => {
      const orderId = await treasury.createOrder(
        ORDER_TYPE_TOKEN_SALE,
        etherToken.address,
        1,
        etherToken2.address,
        5,
        { from: dummyPolicy }
      )

      const offerId = await market.last_offer_id()

      await treasury.cancelOrder(offerId).should.be.rejectedWith('not my policy')
      await treasury.cancelOrder(offerId, { from: dummyPolicy })
      await market.isActive(offerId).should.eventually.eq(false)
    })
  })
})
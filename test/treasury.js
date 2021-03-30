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
const IPolicyTreasury = artifacts.require("./base/IPolicyTreasury")
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

  let treasury
  let dummyPolicy

  let DOES_NOT_HAVE_ROLE
  let HAS_ROLE_CONTEXT

  before(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    market = await ensureMarketIsDeployed({ artifacts, settings })
    etherToken = await ensureEtherTokenIsDeployed({ artifacts, settings })
    await ensurePolicyImplementationsAreDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings })

    DOES_NOT_HAVE_ROLE = (await acl.DOES_NOT_HAVE_ROLE()).toNumber()
    HAS_ROLE_CONTEXT = (await acl.HAS_ROLE_CONTEXT()).toNumber()

    entityAdmin = accounts[9]

    // deploy treasury test facet
    const testFacetImpl = await EntityTreasuryTestFacet.new()
    // add its address to list of entity impl facets
    const addrs = await settings.getAddresses(settings.address, SETTINGS.ENTITY_IMPL)
    settings.setAddresses(settings.address, SETTINGS.ENTITY_IMPL, addrs.concat(testFacetImpl.address))

    entityProxy = await Entity.new(settings.address, entityAdmin, BYTES32_ZERO)
    // now let's speak to Entity contract using EntityImpl ABI
    entity = await IEntity.at(entityProxy.address)
    entityContext = await entityProxy.aclContext()

    treasury = await IPolicyTreasury.at(entityProxy.address)
    
    // set one of my accounts as a dummy policy
    dummyPolicy = accounts[9]
    const testFacet = await IEntityTreasuryTestFacet.at(entityProxy.address)
    await testFacet.setAsMyPolicy(dummyPolicy)
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
    })
  })

  describe('can have min policy balance set', async () => {
    it('but not for a non-policy', async () => {
      await treasury.setMinPolicyBalance(0, { from: accounts[0] }).should.be.rejectedWith('not my policy')
    })

    it('for a policy', async () => {
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
    })

    it('only once', async () => {
      await treasury.setMinPolicyBalance(123, { from: dummyPolicy })
      await treasury.setMinPolicyBalance(123, { from: dummyPolicy }).should.be.rejectedWith('already set')
    })
  })
})
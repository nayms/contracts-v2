import { keccak256 } from './utils/web3'

import {
  EvmSnapshot,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createPolicy,
} from './utils'

import { events } from '../'
import { ROLES, SETTINGS } from '../utils/constants'
import { ensureEtherTokenIsDeployed, deployNewEtherToken } from '../migrations/modules/etherToken'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IMintableToken = artifacts.require('./base/IMintableToken')
const IEntity = artifacts.require("./base/IEntity")
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const AccessControl = artifacts.require('./base/AccessControl')
const TestEntityFacet = artifacts.require("./test/TestEntityFacet")
const FreezeUpgradesFacet = artifacts.require("./test/FreezeUpgradesFacet")
const Entity = artifacts.require("./Entity")
const IPolicy = artifacts.require("./IPolicy")

contract('Entity', accounts => {
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

  before(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)
    await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address)
    await ensureEntityImplementationsAreDeployed({ artifacts }, acl.address, settings.address)

    entityProxy = await Entity.new(acl.address, settings.address)
    // now let's speak to Entity contract using EntityImpl ABI
    entity = await IEntity.at(entityProxy.address)
    entityContext = await entityProxy.aclContext()

    ;([ entityCoreAddress ] = await settings.getRootAddresses(SETTINGS.ENTITY_IMPL))

    etherToken2 = await deployNewEtherToken({ artifacts }, acl.address, settings.address)
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

  describe('it can be upgraded', () => {
    let testEntityFacet
    let freezeUpgradesFacet

    beforeEach(async () => {
      testEntityFacet = await TestEntityFacet.new()
      freezeUpgradesFacet = await FreezeUpgradesFacet.new()
    })

    it('and returns version info', async () => {
      const versionInfo = await entity.getVersionInfo()
      expect(versionInfo.num_).to.exist
      expect(versionInfo.date_).to.exist
      expect(versionInfo.hash_).to.exist
    })

    it('but not just by anyone', async () => {
      await entity.upgrade([ testEntityFacet.address ], { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('but not to the existing implementation', async () => {
      await entity.upgrade([ entityCoreAddress ]).should.be.rejectedWith('Adding functions failed')
    })

    it('and adds the new implementation as a facet', async () => {
      await entity.upgrade([ testEntityFacet.address ]).should.be.fulfilled
      await entity.getNumPolicies().should.eventually.eq(666);
    })

    it('and can be frozen', async () => {
      await entity.upgrade([freezeUpgradesFacet.address]).should.be.fulfilled
      await entity.upgrade([testEntityFacet.address]).should.be.rejectedWith('frozen')
    })

    it('and the internal upgrade function cannot be called directly', async () => {
      const proxy = await IDiamondProxy.at(entity.address)
      await proxy.registerFacets([]).should.be.rejectedWith('external caller not allowed')
    })
  })

  describe('it mints entity tokens', () => {
    beforeEach(async () => {
      await etherToken.deposit({ value: 10 })
      await etherToken.approve(entityProxy.address, 10)

      await etherToken.deposit({ from: accounts[1], value: 10 })
      await etherToken.approve(entityProxy.address, 10, { from: accounts[1] })
    })

    it('can calculate how many depositor will get', async () => {
      await entity.calculateTokensReceivable(etherToken.address, 12).should.eventually.eq(12)
    })

    it('but depositor must have enough', async () => {
      await etherToken.deposit({ value: 10 })
      await etherToken.approve(entityProxy.address, 10)
      await entity.deposit(etherToken.address, 11).should.be.rejectedWith('amount exceeds allowance')
    })

    it('creates the token on the first deposit', async () => {
      await entity.getTokenAddress(etherToken.address).should.eventually.eq(ADDRESS_ZERO)

      await entity.deposit(etherToken.address, 5)

      // unit balances updated
      await etherToken.balanceOf(accounts[0]).should.eventually.eq(5)
      await etherToken.balanceOf(entity.address).should.eventually.eq(5)

      // check entity token
      const tokenAddr = await entity.getTokenAddress(etherToken.address)
      const token = await IMintableToken.at(tokenAddr)

      await token.balanceOf(accounts[0]).should.eventually.eq(5)
      await token.totalSupply().should.eventually.eq(5)
    })

    it('just mints more tokens on subsequent deposits', async () => {
      await entity.deposit(etherToken.address, 5)

      // get entity token
      const tokenAddr = await entity.getTokenAddress(etherToken.address)
      const token = await IMintableToken.at(tokenAddr)

      // next deposit
      await entity.deposit(etherToken.address, 3, { from: accounts[1] })

      // unit balances updated
      await etherToken.balanceOf(accounts[0]).should.eventually.eq(5)
      await etherToken.balanceOf(accounts[1]).should.eventually.eq(7)
      await etherToken.balanceOf(entity.address).should.eventually.eq(8)

      // token balances
      await token.balanceOf(accounts[0]).should.eventually.eq(5)
      await token.balanceOf(accounts[1]).should.eventually.eq(3)
      await token.totalSupply().should.eventually.eq(8)
    })

    it('mints tokens at current price based on unit balance', async () => {
      await entity.deposit(etherToken.address, 5)

      // get entity token
      const tokenAddr = await entity.getTokenAddress(etherToken.address)
      const token = await IMintableToken.at(tokenAddr)

      // token balances
      await token.balanceOf(accounts[0]).should.eventually.eq(5)
      await token.totalSupply().should.eventually.eq(5)

      // add more unit assets to entity
      await etherToken.deposit({ value: 20 })
      await etherToken.transfer(entity.address, 20)

      // do calculation
      await entity.calculateTokensReceivable(etherToken.address, 5).should.eventually.eq(1)

      // next deposit
      await entity.deposit(etherToken.address, 10, { from: accounts[1] })

      // unit balances updated
      await etherToken.balanceOf(accounts[0]).should.eventually.eq(5)
      await etherToken.balanceOf(accounts[1]).should.eventually.eq(0)
      await etherToken.balanceOf(entity.address).should.eventually.eq(35)

      // new token balances
      await token.balanceOf(accounts[0]).should.eventually.eq(5)
      await token.balanceOf(accounts[1]).should.eventually.eq(2)
      await token.totalSupply().should.eventually.eq(7)
    })

    it('only allows the parent entity to mint new tokens', async () => {
      await entity.deposit(etherToken.address, 5)

      // check entity token
      const tokenAddr = await entity.getTokenAddress(etherToken.address)
      const token = await IMintableToken.at(tokenAddr)

      await token.mint(accounts[0], 1).should.be.rejectedWith('only entity can mint tokens')
    })

    describe('allows for tokens to be redeemed', () => {
      let entityToken

      beforeEach(async () => {
        await entity.deposit(etherToken.address, 10)

        await etherToken.deposit({ value: 40 })
        await etherToken.transfer(entity.address, 40)

        await entity.deposit(etherToken.address, 10, { from: accounts[1] })

        const tokenAddr = await entity.getTokenAddress(etherToken.address)
        entityToken = await IMintableToken.at(tokenAddr)

        // unit balances updated
        await etherToken.balanceOf(accounts[0]).should.eventually.eq(0)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(0)
        await etherToken.balanceOf(entity.address).should.eventually.eq(60)

        // new token balances
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(10)
        await entityToken.balanceOf(accounts[1]).should.eventually.eq(2)
        await entityToken.totalSupply().should.eventually.eq(12)
      })

      it('can calculate how much redeemer will get', async () => {
        await entity.calculateAssetsRedeemable(entityToken.address, 10).should.eventually.eq(50)
      })

      it('cannot redeem beyond caller\'s balance', async () => {
        await entity.redeem(entityToken.address, 11).should.be.rejectedWith('overflow')
      })

      it('redeems and returns assets to caller', async () => {
        await entity.redeem(entityToken.address, 10)

        // unit balances updated
        await etherToken.balanceOf(accounts[0]).should.eventually.eq(50)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(0)
        await etherToken.balanceOf(entity.address).should.eventually.eq(10)

        // new token balances
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(0)
        await entityToken.balanceOf(accounts[1]).should.eventually.eq(2)
        await entityToken.totalSupply().should.eventually.eq(2)

        await entity.redeem(entityToken.address, 2, { from: accounts[1] })

        // unit balances updated
        await etherToken.balanceOf(accounts[0]).should.eventually.eq(50)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(10)
        await etherToken.balanceOf(entity.address).should.eventually.eq(0)

        // new token balances
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(0)
        await entityToken.balanceOf(accounts[1]).should.eventually.eq(0)
        await entityToken.totalSupply().should.eventually.eq(0)
      })

      it('always redeems at current price', async () => {
        await entity.redeem(entityToken.address, 10)

        // unit balances updated
        await etherToken.balanceOf(accounts[0]).should.eventually.eq(50)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(0)
        await etherToken.balanceOf(entity.address).should.eventually.eq(10)

        // new token balances
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(0)
        await entityToken.balanceOf(accounts[1]).should.eventually.eq(2)
        await entityToken.totalSupply().should.eventually.eq(2)

        // put some more unit asset in
        await etherToken.deposit({ value: 100 })
        await etherToken.transfer(entity.address, 100)

        await entity.redeem(entityToken.address, 1, { from: accounts[1] })

        // unit balances updated
        await etherToken.balanceOf(accounts[0]).should.eventually.eq(50)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(55)
        await etherToken.balanceOf(entity.address).should.eventually.eq(55)

        // new token balances
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(0)
        await entityToken.balanceOf(accounts[1]).should.eventually.eq(1)
        await entityToken.totalSupply().should.eventually.eq(1)
      })
    })
  })

  describe('uses deposits to buy tokens from the market', () => {
    beforeEach(async () => {
      await etherToken.deposit({ value: 10 })
      await etherToken.approve(entityProxy.address, 10)
      await entity.deposit(etherToken.address, 10).should.be.fulfilled
    })

    it('but not just by anyone', async () => {
      await entity.trade(etherToken.address, 1, etherToken2.address, 1).should.be.rejectedWith('must be trader')
    })

    it('by a trader', async () => {
      await acl.assignRole(entityContext, accounts[3], ROLES.ENTITY_REP)

      await entity.trade(etherToken.address, 1, etherToken2.address, 1, { from: accounts[3] })

      // pre-check
      await etherToken.balanceOf(accounts[5]).should.eventually.eq(0)

      // now match the trade
      await etherToken2.deposit({ value: 1, from: accounts[5] })
      await etherToken2.approve(market.address, 1, { from: accounts[5] })
      const offerId = await market.last_offer_id()
      await market.buy(offerId, 1, { from: accounts[5] })

      // post-check
      await etherToken.balanceOf(accounts[5]).should.eventually.eq(1)
    })
  })

  describe('it sell assets at the best price available', () => {
    beforeEach(async () => {
      await etherToken.deposit({ value: 10 })
      await etherToken.approve(entityProxy.address, 10)
      await entity.deposit(etherToken.address, 10).should.be.fulfilled
    })

    it('but not just by anyone', async () => {
      await entity.sellAtBestPrice(etherToken.address, 1, etherToken2.address).should.be.rejectedWith('must be trader')
    })

    it('by a trader, and only matches offers until full amount sold', async () => {
      // setup offers on market
      await etherToken2.deposit({ value: 100, from: accounts[7] })
      await etherToken2.approve(market.address, 100, { from: accounts[7] })
      await market.offer(100, etherToken2.address, 3, etherToken.address, 0, false, { from: accounts[7] }); // best price, but only buying 3

      await etherToken2.deposit({ value: 50, from: accounts[8] })
      await etherToken2.approve(market.address, 50, { from: accounts[8] })
      await market.offer(50, etherToken2.address, 5, etherToken.address, 0, false, { from: accounts[8] }); // worse price, but able to buy all

      // now sell from the other direction
      await acl.assignRole(entityContext, accounts[3], ROLES.ENTITY_REP)
      await entity.sellAtBestPrice(etherToken.address, 5, etherToken2.address, { from: accounts[3] })

      // check balances
      await etherToken2.balanceOf(entity.address).should.eventually.eq(100 + 20)  // all of 1st offer + 2 from second
      await etherToken.balanceOf(accounts[7]).should.eventually.eq(3)
      await etherToken.balanceOf(accounts[8]).should.eventually.eq(2)
    })
  })

  describe('policies can be created', () => {
    beforeEach(async () => {
      await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_ADMIN)
      await acl.assignRole(entityContext, accounts[2], ROLES.ENTITY_MANAGER)
      await acl.assignRole(entityContext, accounts[3], ROLES.ENTITY_REP)
    })

    it('but not by entity admins', async () => {
      await createPolicy(entity, {}, { from: accounts[1] }).should.be.rejectedWith('must be policy creator')
    })

    it('but not by entity reps', async () => {
      await createPolicy(entity, {}, { from: accounts[3] }).should.be.rejectedWith('must be policy creator')
    })

    it('by entity managers', async () => {
      const result = await createPolicy(entity, {}, { from: accounts[2] }).should.be.fulfilled

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      expect(eventArgs).to.include({
        deployer: accounts[2],
        entity: entityProxy.address,
      })

      await IPolicy.at(eventArgs.policy).should.be.fulfilled;
    })

    it('and the entity records get updated accordingly', async () => {
      await entity.getNumPolicies().should.eventually.eq(0)

      const result = await createPolicy(entity, {}, { from: accounts[2] })
      const eventArgs = extractEventArgs(result, events.NewPolicy)

      await entity.getNumPolicies().should.eventually.eq(1)
      await entity.getPolicy(0).should.eventually.eq(eventArgs.policy)

      const result2 = await createPolicy(entity, {}, { from: accounts[2] })
      const eventArgs2 = extractEventArgs(result2, events.NewPolicy)

      await entity.getNumPolicies().should.eventually.eq(2)
      await entity.getPolicy(1).should.eventually.eq(eventArgs2.policy)
    })

    it('and have their properties set', async () => {
      const startDate = ~~(Date.now() / 1000) + 1

      const result = await createPolicy(entity, {
        startDate,
      }, { from: accounts[2] })

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      const policy = await IPolicy.at(eventArgs.policy)
      await policy.getInfo().should.eventually.matchObj({
        startDate: startDate
      })
    })

    it('and have the original caller set as policy owner', async () => {
      const result = await createPolicy(entity, {}, { from: accounts[2] })

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      const policy = await IPolicy.at(eventArgs.policy)

      const policyContext = await policy.aclContext()

      await acl.hasRole(policyContext, accounts[2], ROLES.POLICY_OWNER).should.eventually.eq(true)
    })

    describe('and policy tranch premiums can be paid', () => {
      let policyOwner
      let policy
      let policyContext

      const premiumAmount = 50000000000

      beforeEach(async () => {
        policyOwner = accounts[2]

        const blockTime = (await settings.getTime()).toNumber()

        const result = await createPolicy(entity, {
          initiationDate: blockTime + 100,
          startDate: blockTime + 200,
          maturationDate: blockTime + 300,
          unit: etherToken.address
        }, { from: policyOwner }).should.be.fulfilled

        const eventArgs = extractEventArgs(result, events.NewPolicy)

        policy = await IPolicy.at(eventArgs.policy);
        const accessControl = await AccessControl.at(policy.address)
        policyContext = await accessControl.aclContext()

        await policy.createTranch(1, 1, [premiumAmount], ADDRESS_ZERO, { from: policyOwner })
      })

      it('but not by anyone', async () => {
        await entity.payTranchPremium(policy.address, 0, { from: policyOwner }).should.be.rejectedWith('must be entity rep')
      })

      it('but not by entity rep who is not registered as a client manager on the policy', async () => {
        const entityRep = accounts[3]
        await entity.payTranchPremium(policy.address, 0, { from: entityRep }).should.be.rejectedWith('must be client manager')
      })

      it('but not by entity rep if we do not have enough tokens to pay with', async () => {
        const entityRep = accounts[3]
        await acl.assignRole(policyContext, entityRep, ROLES.CLIENT_MANAGER)
        await entity.payTranchPremium(policy.address, 0, { from: entityRep }).should.be.rejectedWith('transfer amount exceeds balance')
      })

      it('by entity rep if we have enough tokens to pay with', async () => {
        await etherToken.deposit({ value: premiumAmount })
        await etherToken.approve(entity.address, premiumAmount)
        await entity.deposit(etherToken.address, premiumAmount)
        const entityRep = accounts[3]
        await acl.assignRole(policyContext, entityRep, ROLES.CLIENT_MANAGER)
        await entity.payTranchPremium(policy.address, 0, { from: entityRep }).should.be.fulfilled
      })
    })
  })
})
import { keccak256 } from './utils/web3'

import {
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createPolicy,
} from './utils'

import { events } from '../'
import { ROLES } from '../utils/constants'
import { ensureEtherTokenIsDeployed, deployNewEtherToken } from '../migrations/modules/etherToken'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IEntityImpl = artifacts.require("./base/IEntityImpl")
const Proxy = artifacts.require('./base/Proxy')
const AccessControl = artifacts.require('./base/AccessControl')
const TestEntityImpl = artifacts.require("./test/TestEntityImpl")
const Entity = artifacts.require("./Entity")
const EntityImpl = artifacts.require("./EntityImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")

contract('Entity', accounts => {
  let acl
  let settings
  let etherToken
  let etherToken2
  let entityImpl
  let market
  let entityProxy
  let entity
  let entityContext

  beforeEach(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)
    await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address)

    entityImpl = await EntityImpl.new(acl.address, settings.address)
    entityProxy = await Entity.new(
      acl.address,
      settings.address,
      entityImpl.address
    )
    // now let's speak to Entity contract using EntityImpl ABI
    entity = await IEntityImpl.at(entityProxy.address)
    entityContext = await entityProxy.aclContext()

    etherToken2 = await deployNewEtherToken({ artifacts }, acl.address, settings.address)
  })

  it('must be deployed with a valid implementation', async () => {
    await Entity.new(
      acl.address,
      settings.address,
      ADDRESS_ZERO
    ).should.be.rejectedWith('implementation must be valid')
  })

  it('can be deployed', async () => {
    expect(entityProxy.address).to.exist
  })

  it('can return its implementation version', async () => {
    await entityImpl.getImplementationVersion().should.eventually.eq('v1')
  })

  describe('it can be upgraded', () => {
    let entityImpl2
    let entityAdminSig
    let entityManagerSig
    let entityRepresentativeSig

    beforeEach(async () => {
      // deploy new implementation
      entityImpl2 = await TestEntityImpl.new()

      // generate upgrade approval signatures
      const implVersion = await entityImpl2.getImplementationVersion()

      await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_ADMIN)
      entityAdminSig = hdWallet.sign({ address: accounts[1], data: keccak256(implVersion) })

      await acl.assignRole(entityContext, accounts[2], ROLES.ENTITY_MANAGER)
      entityManagerSig = hdWallet.sign({ address: accounts[2], data: keccak256(implVersion) })

      await acl.assignRole(entityContext, accounts[3], ROLES.ENTITY_REP)
      entityRepresentativeSig = hdWallet.sign({ address: accounts[3], data: keccak256(implVersion) })
    })

    it('but not just by anyone', async () => {
      await entityProxy.upgrade(entityImpl2.address, entityAdminSig, { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('but not with entity manager\'s signature', async () => {
      await entityProxy.upgrade(entityImpl2.address, entityManagerSig).should.be.rejectedWith('must be approved by entity admin')
    })

    it('but not with entity rep\'s signature', async () => {
      await entityProxy.upgrade(entityImpl2.address, entityRepresentativeSig).should.be.rejectedWith('must be approved by entity admin')
    })

    it('but not to an empty address', async () => {
      await entityProxy.upgrade(ADDRESS_ZERO, entityAdminSig).should.be.rejectedWith('implementation must be valid')
    })

    it.skip('but not to the existing implementation', async () => {
      const oldVersion = await entityImpl.getImplementationVersion()
      entityManagerSig = hdWallet.sign({ address: accounts[1], data: keccak256(oldVersion) })
      await entityProxy.upgrade(entityImpl.address, entityAdminSig).should.be.rejectedWith('already this implementation')
    })

    it('and points to the new implementation', async () => {
      const result = await entityProxy.upgrade(entityImpl2.address, entityAdminSig).should.be.fulfilled

      expect(extractEventArgs(result, events.Upgraded)).to.include({
        implementation: entityImpl2.address,
        version: 'vTest',
      })
    })
  })

  describe('it can take deposits', () => {
    it('but sender must have enough', async () => {
      await etherToken.deposit({ value: 10 })
      await etherToken.approve(entityProxy.address, 10)
      await entity.deposit(etherToken.address, 11).should.be.rejectedWith('amount exceeds allowance')
    })

    it('but sender must have previously authorized the entity to do the transfer', async () => {
      await etherToken.deposit({ value: 10 })
      await entity.deposit(etherToken.address, 5).should.be.rejectedWith('amount exceeds allowance')
    })

    it('and gets credited with the amount', async () => {
      await etherToken.deposit({ value: 10 })
      await etherToken.approve(entityProxy.address, 10)
      await entity.deposit(etherToken.address, 10).should.be.fulfilled
      await etherToken.balanceOf(entityProxy.address).should.eventually.eq(10)
    })

    describe('and enables subsequent withdrawals', () => {
      beforeEach(async () => {
        await etherToken.deposit({ value: 10 })
        await etherToken.approve(entityProxy.address, 10)
        await entity.deposit(etherToken.address, 10)
      })

      it('but not by just anyone', async () => {
        await entity.withdraw(etherToken.address, 10, { from: accounts[1] }).should.be.rejectedWith('must be entity admin')
      })

      it('by entity admin', async () => {
        await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_ADMIN)
        await entity.withdraw(etherToken.address, 10, { from: accounts[1] }).should.be.fulfilled
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(10)
        await etherToken.balanceOf(accounts[0]).should.eventually.eq(0)
      })
    })

    describe('and use those deposits to buy tokens from the market', () => {
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

    describe('and sell assets at the best price available', () => {
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
  })

  describe('policies can be created', () => {
    let policyImpl

    beforeEach(async () => {
      ;({ policyImpl } = await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address))

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

      await PolicyImpl.at(eventArgs.policy).should.be.fulfilled;
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

      const policy = await PolicyImpl.at(eventArgs.policy)

      await policy.getInfo().should.eventually.matchObj({
        startDate_: startDate
      })

      const proxy = await Proxy.at(eventArgs.policy)
      await proxy.getImplementation().should.eventually.eq(policyImpl.address)
    })

    it('and have the original caller set as policy owner', async () => {
      const result = await createPolicy(entity, {}, { from: accounts[2] })

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      const policy = await PolicyImpl.at(eventArgs.policy)

      const policyContext = await policy.aclContext()

      await acl.hasRole(policyContext, accounts[2], ROLES.POLICY_OWNER).should.eventually.eq(true)
    })

    it('and have the creating entity set', async () => {
      const result = await createPolicy(entity, {}, { from: accounts[2] })

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      const policy = await PolicyImpl.at(eventArgs.policy)

      await policy.getInfo().should.eventually.matchObj({
        creatorEntity_: entity.address,
      })
    })

    describe('and policy tranch premiums can be paid', () => {
      let policyOwner
      let policy
      let policyContext

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

        policy = await PolicyImpl.at(eventArgs.policy);
        const accessControl = await AccessControl.at(policy.address)
        policyContext = await accessControl.aclContext()

        await policy.createTranch(1, 1, [ 1 ], ADDRESS_ZERO, { from: policyOwner })
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
        await etherToken.deposit({ value: 1 })
        await etherToken.approve(entity.address, 1)
        await entity.deposit(etherToken.address, 1)
        const entityRep = accounts[3]
        await acl.assignRole(policyContext, entityRep, ROLES.CLIENT_MANAGER)
        await entity.payTranchPremium(policy.address, 0, { from: entityRep }).should.be.fulfilled
      })
    })
  })
})

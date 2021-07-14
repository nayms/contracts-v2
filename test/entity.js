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

import { events } from '../'
import { ROLES, SETTINGS } from '../utils/constants'
import { ensureEtherTokenIsDeployed, deployNewEtherToken } from '../migrations/modules/etherToken'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IEntity = artifacts.require("./base/IEntity")
const Proxy = artifacts.require('./base/Proxy')
const IERC20 = artifacts.require('./base/IERC20')
const IDiamondUpgradeFacet = artifacts.require('./base/IDiamondUpgradeFacet')
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const AccessControl = artifacts.require('./base/AccessControl')
const DummyEntityFacet = artifacts.require("./test/DummyEntityFacet")
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

  let entityAdmin

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

    entityProxy = await Entity.new(settings.address, entityAdmin, BYTES32_ZERO)
    // now let's speak to Entity contract using EntityImpl ABI
    entity = await IEntity.at(entityProxy.address)
    entityContext = await entityProxy.aclContext()

    ;([ entityCoreAddress ] = await settings.getRootAddresses(SETTINGS.ENTITY_IMPL))

    etherToken2 = await deployNewEtherToken({ artifacts, settings })
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
    let dummyEntityTestFacet
    let freezeUpgradesFacet
    let entityDelegate
 
    beforeEach(async () => {
      dummyEntityTestFacet = await DummyEntityFacet.new()
      freezeUpgradesFacet = await FreezeUpgradesFacet.new()
      
      const proxy = await Proxy.at(entity.address)
      const delegateAddress = await proxy.getDelegateAddress()
      entityDelegate = await IDiamondUpgradeFacet.at(delegateAddress)
    })

    it('and returns version info', async () => {
      const versionInfo = await entity.getVersionInfo()
      expect(versionInfo.num_).to.exist
      expect(versionInfo.date_).to.exist
      expect(versionInfo.hash_).to.exist
    })

    it('but not just by anyone', async () => {
      await entityDelegate.upgrade([ dummyEntityTestFacet.address ], { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('but not to the existing implementation', async () => {
      await entityDelegate.upgrade([ entityCoreAddress ]).should.be.rejectedWith('Adding functions failed')
    })

    it('and adds the new implementation as a facet', async () => {
      await entityDelegate.upgrade([ dummyEntityTestFacet.address ]).should.be.fulfilled
      await entity.getNumPolicies().should.eventually.eq(666);
    })

    it('and can be frozen', async () => {
      await entityDelegate.upgrade([freezeUpgradesFacet.address]).should.be.fulfilled
      await entityDelegate.upgrade([dummyEntityTestFacet.address]).should.be.rejectedWith('frozen')
    })

    it('and the internal upgrade function cannot be called directly', async () => {
      const diamondProxy = await IDiamondProxy.at(entity.address)
      await diamondProxy.registerFacets([]).should.be.rejectedWith('external caller not allowed')
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
      await entity.getBalance(etherToken.address).should.eventually.eq(10)
    })

    it('and emits an event', async () => {
      await etherToken.deposit({ value: 10 })
      await etherToken.approve(entityProxy.address, 10)
      const result = await entity.deposit(etherToken.address, 10).should.be.fulfilled

      const eventArgs = extractEventArgs(result, events.EntityDeposit)

      expect(eventArgs).to.include({
        caller: accounts[0],
        unit: etherToken.address,
        amount: '10'
      })
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
        await entity.withdraw(etherToken.address, 10, { from: entityAdmin }).should.be.fulfilled
        await etherToken.balanceOf(entityAdmin).should.eventually.eq(10)
      })

      it('and only upto the amount that was explicitly deposited, i.e. excluding accidental sends', async () =>{
        await etherToken.deposit({ value: 200 })
        
        // direct transfer 100
        await etherToken.transfer(entity.address, 100)
        
        // explicitly deposit 10 more
        await etherToken.approve(entityProxy.address, 10)
        await entity.deposit(etherToken.address, 10)
        await etherToken.balanceOf(entity.address).should.eventually.eq(120)
        await entity.getBalance(etherToken.address).should.eventually.eq(20)

        // withdrawing this should fail
        await entity.withdraw(etherToken.address, 21, { from: entityAdmin }).should.be.rejectedWith('exceeds entity balance')

        // this should work
        await entity.withdraw(etherToken.address, 20, { from: entityAdmin }).should.be.fulfilled

        await entity.getBalance(etherToken.address).should.eventually.eq(0)
      })

      it('and emits an event upon withdrawal', async () => {
        await etherToken.deposit({ value: 200 })
        await etherToken.approve(entityProxy.address, 10)
        await entity.deposit(etherToken.address, 10)
        await etherToken.balanceOf(entity.address).should.eventually.eq(20)

        const result = await entity.withdraw(etherToken.address, 20, { from: entityAdmin })

        const eventArgs = extractEventArgs(result, events.EntityWithdraw)

        expect(eventArgs).to.include({
          caller: entityAdmin,
          unit: etherToken.address,
          amount: '20'
        })
      })

      it('and updates balance upon withdrawal, which affets subsequent withdrawals', async () => {
        await etherToken.balanceOf(entity.address).should.eventually.eq(10)

        await entity.withdraw(etherToken.address, 10, { from: entityAdmin })
        await entity.withdraw(etherToken.address, 1, { from: entityAdmin }).should.be.rejectedWith('exceeds entity balance')
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

      describe('by a trader', () => {
        beforeEach(async () => {
          await acl.assignRole(entityContext, accounts[3], ROLES.ENTITY_REP)
        })

        it('works', async () => {
          await entity.trade(etherToken.address, 1, etherToken2.address, 1, { from: accounts[3] })

          // pre-check
          await etherToken.balanceOf(accounts[5]).should.eventually.eq(0)

          // now match the trade
          await etherToken2.deposit({ value: 1, from: accounts[5] })
          await etherToken2.approve(market.address, 1, { from: accounts[5] })
          const offerId = await market.getLastOfferId()
          await market.buy(offerId, 1, { from: accounts[5] })

          // post-check
          await etherToken.balanceOf(accounts[5]).should.eventually.eq(1)
        })

        it('and can only use upto the amount that was explicitly deposited, i.e. excluding accidental sends', async () => {
          await etherToken.deposit({ value: 200 })

          // direct transfer 100
          await etherToken.transfer(entity.address, 100)

          // check balance
          await etherToken.balanceOf(entity.address).should.eventually.eq(110)

          // trading more than is explicitly deposited should fail
          await entity.trade(etherToken.address, 11, etherToken2.address, 1, { from: accounts[3] }).should.be.rejectedWith('exceeds entity balance')

          // trading the max possible amount is ok
          await entity.trade(etherToken.address, 10, etherToken2.address, 1, { from: accounts[3] }).should.be.fulfilled
        })
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

      describe('by a trader', () => {
        beforeEach(async () => {
          await acl.assignRole(entityContext, accounts[3], ROLES.ENTITY_REP)
        })

        it('works', async () => {
          // setup offers on market
          await etherToken2.deposit({ value: 100, from: accounts[7] })
          await etherToken2.approve(market.address, 100, { from: accounts[7] })
          await market.executeLimitOffer(etherToken2.address, 100, etherToken.address, 3, { from: accounts[7] }); // best price, but only buying 3

          let offerId, offer

          await etherToken2.deposit({ value: 50, from: accounts[8] })
          await etherToken2.approve(market.address, 50, { from: accounts[8] })
          await market.executeLimitOffer(etherToken2.address, 50, etherToken.address, 5, { from: accounts[8] }); // worse price, but able to buy all

          offerId = (await market.getBestOfferId(etherToken2.address, etherToken.address)).toNumber()

          // now sell from the other direction
          await entity.sellAtBestPrice(etherToken.address, 5, etherToken2.address, { from: accounts[3] })

          // check balances
          await etherToken2.balanceOf(entity.address).should.eventually.eq(100 + 20)  // all of 1st offer + 2 from second
          await etherToken.balanceOf(accounts[7]).should.eventually.eq(3)
          await etherToken.balanceOf(accounts[8]).should.eventually.eq(2)
        })

        it('and can only sell upto the amount that was explicitly deposited, i.e. excluding accidental sends', async () => {
          await etherToken.deposit({ value: 200 })

          // direct transfer 100
          await etherToken.transfer(entity.address, 100)

          // check balance
          await etherToken.balanceOf(entity.address).should.eventually.eq(110)

          // setup matching offer
          await etherToken2.deposit({ value: 50, from: accounts[8] })
          await etherToken2.approve(market.address, 50, { from: accounts[8] })
          await market.executeLimitOffer(etherToken2.address, 50, etherToken.address, 10, { from: accounts[8] });

          // trading more than is explicitly deposited should fail
          await entity.sellAtBestPrice(etherToken.address, 11, etherToken2.address, { from: accounts[3] }).should.be.rejectedWith('exceeds entity balance')

          // trading the max possible amount is ok
          await entity.sellAtBestPrice(etherToken.address, 10, etherToken2.address, { from: accounts[3] }).should.be.fulfilled
        })
      })
    })
  })

  describe.only('entity tokens', () => {
    const entityManager = accounts[2]

    beforeEach(async () => {
      await acl.assignRole(entityContext, entityManager, ROLES.ENTITY_MANAGER)
    })

    it('initially do not exist', async () => {
      await entity.getTokenInfo().should.eventually.matchObj({
        contract_: ADDRESS_ZERO,
        currentTokenSaleOfferId_: 0,
      })
    })

    describe('are minted by starting a sale', () => {
      it('but must be by entity mgr', async () => {
        await entity.startTokenSale(500, etherToken.address, 1000).should.be.rejectedWith('must be entity mgr')
      })

      it('and creates a market offer', async () => {
        await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

        const tokenInfo = await entity.getTokenInfo()

        expect(tokenInfo.tokenContract_).to.not.eq(ADDRESS_ZERO)
        expect(tokenInfo.currentTokenSaleOfferId_).to.not.eq(0)

        const offerId = await market.getLastOfferId()

        await market.getOffer(offerId).should.eventually.matchObj({
          creator_: entity.address,
          sellToken_: tokenInfo.tokenContract_,
          sellAmount_: 500,
          buyToken_: etherToken.address,
          buyAmount_: 1000,
          isActive_: true,
        })

        const entityToken = await IERC20.at(tokenInfo.tokenContract_)
        await entityToken.totalSupply().should.eventually.eq(500)
      })

      it('and tokens can partially sell', async ()=> {
        await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

        const tokenInfo = await entity.getTokenInfo()

        const offerId = await market.getLastOfferId()

        await etherToken.deposit({ value: 500 })
        await etherToken.approve(market.address, 500)
        await market.executeLimitOffer(etherToken.address, 500, tokenInfo.tokenContract_, 250)

        await market.getOffer(offerId).should.eventually.matchObj({
          sellToken_: tokenInfo.contract_,
          sellAmount_: 250,
          buyToken_: etherToken.address,
          buyAmount_: 500,
          isActive_: true,
        })

        await etherToken.balanceOf(entity.address).should.eventually.eq(500)

        const entityToken = await IERC20.at(tokenInfo.tokenContract_)
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(250)
        await entityToken.totalSupply().should.eventually.eq(500)
      })
      
      it('and tokens can fully sell', async ()=> {
        await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

        const tokenInfo = await entity.getTokenInfo()

        const offerId = await market.getLastOfferId()

        await etherToken.deposit({ value: 1000 })
        await etherToken.approve(market.address, 1000)
        await market.executeLimitOffer(etherToken.address, 1000, tokenInfo.tokenContract_, 500)

        await market.getOffer(offerId).should.eventually.matchObj({
          isActive_: false,
        })

        await etherToken.balanceOf(entity.address).should.eventually.eq(1000)

        const entityToken = await IERC20.at(tokenInfo.tokenContract_)
        await entityToken.totalSupply().should.eventually.eq(500)
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(500)

        await entity.getTokenInfo().should.matchObj({
          currentTokenSaleOfferId_: 0,
        })
      })

      describe('and once sold', () => {
        let tokenInfo
        let entityToken

        beforeEach(async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

          tokenInfo = await entity.getTokenInfo()

          await etherToken.deposit({ value: 1000 })
          await etherToken.approve(market.address, 1000)
          await market.executeLimitOffer(etherToken.address, 1000, tokenInfo.tokenContract_, 500)

          entityToken = await IERC20.at(tokenInfo.tokenContract_)

          await entityToken.balanceOf(accounts[0]).should.eventually.eq(500)
          await entityToken.totalSupply().should.eventually.eq(500)
        })

        it('can only be transferred by the market', async () => {
          await entityToken.approve(accounts[2], 1).should.be.rejectedWith('only nayms market is allowed to transfer')
          await entityToken.transfer(accounts[2], 1).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('can be burnt', async () => {
          await entity.burnTokens(1).should.be.fulfilled
          
          await entityToken.balanceOf(accounts[0]).should.eventually.eq(499)
          await entityToken.totalSupply().should.eventually.eq(499)
        })

        it('cannot be burnt if more than balance', async () => {
          await entity.burnTokens(1001).should.be.rejectedWith('not enough balance to burn')
        })
      })


      describe('and a sale can be cancelled', () => {
        it('but only by entity mgr', async () => {
          await entity.cancelTokenSale().should.be.rejectedWith('must be entity mgr')
        })

        it('but only if a sale is active', async () => {
          await entity.cancelTokenSale({ from: entityManager }).should.be.rejectedWith('no active token sale')
        })

        it('if active', async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })
          await entity.cancelTokenSale({ from: entityManager }).should.be.fulfilled
          await entity.getTokenInfo().should.matchObj({
            currentTokenSaleOfferId_: 0,
          })
        })

        it('and burns unsold tokens', async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

          const tokenInfo = await entity.getTokenInfo()
          const entityToken = await IERC20.at(tokenInfo.tokenContract_)

          await entityToken.totalSupply().should.eventually.eq(500)

          await entity.cancelTokenSale({ from: entityManager }).should.be.fulfilled

          await entityToken.totalSupply().should.eventually.eq(0)
        })
      })

      describe('and funds withdrawals are prevented', () => {
        it('when token supply is non-zero', async () => {
          await entity.cancelTokenSale().should.be.rejectedWith('must be entity mgr')
        })

        it('but only if a sale is active', async () => {
          await entity.cancelTokenSale({ from: entityManager }).should.be.rejectedWith('no active token sale')
        })

        it('if active', async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })
          await entity.cancelTokenSale({ from: entityManager }).should.be.fulfilled
          await entity.getTokenInfo().should.matchObj({
            currentTokenSaleOfferId_: 0,
          })
        })

        it('and burns unsold tokens', async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

          const tokenInfo = await entity.getTokenInfo()
          const entityToken = await IERC20.at(tokenInfo.tokenContract_)

          await entityToken.totalSupply().should.eventually.eq(500)

          await entity.cancelTokenSale({ from: entityManager }).should.be.fulfilled

          await entityToken.totalSupply().should.eventually.eq(0)
        })
      })
    })
  })

  describe('policies can be created', () => {
    const entityManager = accounts[2]
    const entityRep = accounts[3]

    beforeEach(async () => {
      await acl.assignRole(entityContext, entityManager, ROLES.ENTITY_MANAGER)
      await acl.assignRole(entityContext, entityRep, ROLES.ENTITY_REP)
    })

    it('by anyone', async () => {
      await createPolicy(entity, {}, { from: accounts[9] }).should.be.fulfilled
    })

    it('and underwriter acl context must be same as creating entity', async () => {
      await createPolicy(entity, {
        underwriter: entity.address,
      }, { from: accounts[9] }).should.be.fulfilled

      const entity2 = await Entity.new(settings.address, entityAdmin, BYTES32_ZERO)

      await createPolicy(entity, {
        underwriter: entity2.address,
      }, { from: accounts[9] }).should.be.rejectedWith('underwriter ACL context must match')

      const entity3 = await Entity.new(settings.address, entityAdmin, entityContext)

      await createPolicy(entity, {
        underwriter: entity3.address,
      }, { from: accounts[9] }).should.be.fulfilled
    })

    it('and they exist', async () => {
      const result = await createPolicy(entity, {}, { from: entityRep }).should.be.fulfilled

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      expect(eventArgs).to.include({
        deployer: entityRep,
        entity: entityProxy.address,
      })

      await IPolicy.at(eventArgs.policy).should.be.fulfilled;
    })

    it('and the entity records get updated accordingly', async () => {
      await entity.getNumPolicies().should.eventually.eq(0)

      const result = await createPolicy(entity, {}, { from: entityRep })
      const eventArgs = extractEventArgs(result, events.NewPolicy)

      await entity.getNumPolicies().should.eventually.eq(1)
      await entity.getPolicy(0).should.eventually.eq(eventArgs.policy)

      const result2 = await createPolicy(entity, {}, { from: entityRep })
      const eventArgs2 = extractEventArgs(result2, events.NewPolicy)

      await entity.getNumPolicies().should.eventually.eq(2)
      await entity.getPolicy(1).should.eventually.eq(eventArgs2.policy)
    })

    it('and have their properties set', async () => {
      const startDate = ~~(Date.now() / 1000) + 1

      const result = await createPolicy(entity, {
        startDate,
      }, { from: entityRep })

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      const policy = await IPolicy.at(eventArgs.policy)
      await policy.getInfo().should.eventually.matchObj({
        startDate: startDate
      })
    })

    it('and have the original caller set as policy owner', async () => {
      const result = await createPolicy(entity, {}, { from: entityRep })

      const eventArgs = extractEventArgs(result, events.NewPolicy)

      const policy = await IPolicy.at(eventArgs.policy)

      const policyContext = await policy.aclContext()

      await acl.hasRole(policyContext, entityRep, ROLES.POLICY_OWNER).should.eventually.eq(HAS_ROLE_CONTEXT)
    })

    describe('and policy tranch premiums can be paid', () => {
      let policyOwner
      let policy
      let policyContext

      const premiumAmount = 50000000000

      beforeEach(async () => {
        policyOwner = entityRep

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

        await createTranch(policy, { 
          numShares: 1,
          pricePerShareAmount: 1,
          premiums: [premiumAmount],
        }, { from: policyOwner })
      })

      it('but not by anyone', async () => {
        await entity.payTranchPremium(policy.address, 0, premiumAmount, { from: accounts[8] }).should.be.rejectedWith('must be entity rep')
      })

      it('but not by entity rep if we do not have enough tokens to pay with', async () => {
        await entity.payTranchPremium(policy.address, 0, premiumAmount, { from: entityRep }).should.be.rejectedWith('exceeds entity balance')
      })

      it('by entity rep if we have enough tokens to pay with', async () => {
        await etherToken.deposit({ value: premiumAmount })
        await etherToken.approve(entity.address, premiumAmount)
        await entity.deposit(etherToken.address, premiumAmount)
        await entity.payTranchPremium(policy.address, 0, premiumAmount, { from: entityRep }).should.be.fulfilled
      })

      it('by entity rep if we have enough tokens to pay with, excluding tokens directly sent to entity', async () => {
        await etherToken.deposit({ value: premiumAmount })
        await etherToken.transfer(entity.address, premiumAmount)
        await entity.payTranchPremium(policy.address, 0, premiumAmount, { from: entityRep }).should.be.rejectedWith('exceeds entity balance')
      })
    })
  })
})
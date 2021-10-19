import {
  EvmSnapshot,
  extractEventArgs,
  ADDRESS_ZERO,
  BYTES32_ZERO,
  createEntity,
  createPolicy,
  createTranch,
} from './utils'

import { events } from '../'
import { ROLES, SETTINGS } from '../utils/constants'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureMarketIsDeployed } from '../deploy/modules/market'
import { ensureFeeBankIsDeployed } from '../deploy/modules/feeBank'
import { ensureEntityDeployerIsDeployed } from '../deploy/modules/entityDeployer'
import { ensureEntityImplementationsAreDeployed } from '../deploy/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../deploy/modules/policyImplementations'
import { getAccounts } from '../deploy/utils'

const IEntity = artifacts.require("base/IEntity")
const Proxy = artifacts.require('base/Proxy')
const IERC20 = artifacts.require('base/IERC20')
const DummyToken = artifacts.require('DummyToken')
const IDiamondUpgradeFacet = artifacts.require('base/IDiamondUpgradeFacet')
const IDiamondProxy = artifacts.require('base/IDiamondProxy')
const AccessControl = artifacts.require('base/AccessControl')
const DummyEntityFacet = artifacts.require("test/DummyEntityFacet")
const FreezeUpgradesFacet = artifacts.require("test/FreezeUpgradesFacet")
const IMarketFeeSchedules = artifacts.require("base/IMarketFeeSchedules")
const Entity = artifacts.require("Entity")
const IPolicy = artifacts.require("IPolicy")

describe('Entity', () => {
  const evmSnapshot = new EvmSnapshot()

  let accounts

  let acl
  let settings
  let entityDeployer
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

  let FEE_SCHEDULE_STANDARD
  let FEE_SCHEDULE_PLATFORM_ACTION

  before(async () => {
    accounts = await getAccounts()
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    market = await ensureMarketIsDeployed({ artifacts, settings })
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    await ensureFeeBankIsDeployed({ artifacts, settings })
    await ensurePolicyImplementationsAreDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings })
    
    DOES_NOT_HAVE_ROLE = (await acl.DOES_NOT_HAVE_ROLE()).toNumber()
    HAS_ROLE_CONTEXT = (await acl.HAS_ROLE_CONTEXT()).toNumber()
    
    entityAdmin = accounts[9]
    
    const entityAddress = await createEntity({ entityDeployer, adminAddress: entityAdmin })
    entityProxy = await Entity.at(entityAddress)
    // now let's speak to Entity contract using EntityImpl ABI
    entity = await IEntity.at(entityProxy.address)
    entityContext = await entityProxy.aclContext()
    
    ;([ entityCoreAddress ] = await settings.getRootAddresses(SETTINGS.ENTITY_IMPL))
    
    const { facets: [marketCoreAddress] } = market
    const mktFeeSchedules = await IMarketFeeSchedules.at(marketCoreAddress)
    FEE_SCHEDULE_STANDARD = await mktFeeSchedules.FEE_SCHEDULE_STANDARD()
    FEE_SCHEDULE_PLATFORM_ACTION = await mktFeeSchedules.FEE_SCHEDULE_PLATFORM_ACTION()

    etherToken = await DummyToken.new('Wrapped ETH', 'WETH', 18, 0, false)
    etherToken2 = await DummyToken.new('Wrapped ETH 2', 'WETH2', 18, 0, true)
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
  
  it('has its parent set', async () => {
    await entity.getParent().should.eventually.eq(entityDeployer.address)
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
      await entity.getBalance(accounts[0]).should.eventually.eq(123);
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
          await market.executeLimitOffer(etherToken2.address, 100, etherToken.address, 3, FEE_SCHEDULE_STANDARD, { from: accounts[7] }); // best price, but only buying 3

          let offerId, offer

          await etherToken2.deposit({ value: 50, from: accounts[8] })
          await etherToken2.approve(market.address, 50, { from: accounts[8] })
          await market.executeLimitOffer(etherToken2.address, 50, etherToken.address, 5, FEE_SCHEDULE_STANDARD, { from: accounts[8] }); // worse price, but able to buy all

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
          await market.executeLimitOffer(etherToken2.address, 50, etherToken.address, 10, FEE_SCHEDULE_STANDARD, { from: accounts[8] });

          // trading more than is explicitly deposited should fail
          await entity.sellAtBestPrice(etherToken.address, 11, etherToken2.address, { from: accounts[3] }).should.be.rejectedWith('exceeds entity balance')

          // trading the max possible amount is ok
          await entity.sellAtBestPrice(etherToken.address, 10, etherToken2.address, { from: accounts[3] }).should.be.fulfilled
        })
      })
    })
  })

  describe('entity tokens', () => {
    let entityManager

    beforeEach(async () => {
      entityManager = accounts[2]
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

      it('and only one sale can be in progress at a time', async () => {
        await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })
        await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager }).should.be.rejectedWith('token sale in progress')
      })

      it('and tokens have basic properties', async () => {
        await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

        const tokenInfo = await entity.getTokenInfo()
        const entityToken = await IERC20.at(tokenInfo.tokenContract_)

        expect((await entityToken.name()).toLowerCase()).to.eq(`NAYMS-${entity.address}-ENTITY`.toLowerCase())
        expect((await entityToken.symbol()).toLowerCase()).to.eq(`N-${entity.address.substr(0, 6)}-E`.toLowerCase())
        await entityToken.totalSupply().should.eventually.eq(500)
        await entityToken.balanceOf(market.address).should.eventually.eq(500)
        await entityToken.allowance(market.address, entity.address).should.eventually.eq(0)
      })

      it('and tokens can partially sell', async ()=> {
        await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

        const tokenInfo = await entity.getTokenInfo()

        const offerId = await market.getLastOfferId()

        await etherToken.deposit({ value: 500 })
        await etherToken.approve(market.address, 500)
        await market.executeLimitOffer(etherToken.address, 500, tokenInfo.tokenContract_, 250, FEE_SCHEDULE_STANDARD)

        await market.getOffer(offerId).should.eventually.matchObj({
          sellToken_: tokenInfo.contract_,
          sellAmount_: 250,
          buyToken_: etherToken.address,
          buyAmount_: 500,
          isActive_: true,
        })

        await etherToken.balanceOf(entity.address).should.eventually.eq(500)
        await entity.getBalance(etherToken.address).should.eventually.eq(500)

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
        await market.executeLimitOffer(etherToken.address, 1000, tokenInfo.tokenContract_, 500, FEE_SCHEDULE_STANDARD)

        await market.getOffer(offerId).should.eventually.matchObj({
          isActive_: false,
        })

        await etherToken.balanceOf(entity.address).should.eventually.eq(1000)
        await entity.getBalance(etherToken.address).should.eventually.eq(1000)

        const entityToken = await IERC20.at(tokenInfo.tokenContract_)
        await entityToken.totalSupply().should.eventually.eq(500)
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(500)

        await entity.getTokenInfo().should.eventually.matchObj({
          currentTokenSaleOfferId_: 0,
        })
      })

      describe('and token transfers are controlled such that', () => {
        let entityToken

        beforeEach(async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })
          await etherToken.deposit({ value: 500 })
          await etherToken.approve(market.address, 500)

          const tokenInfo = await entity.getTokenInfo()

          await market.executeLimitOffer(etherToken.address, 500, tokenInfo.tokenContract_, 250, FEE_SCHEDULE_STANDARD)
          
          entityToken = await IERC20.at(tokenInfo.tokenContract_)
          await entityToken.balanceOf(accounts[0]).should.eventually.eq(250)
          
          // temp set accounts[0] as market
          await settings.setAddress(settings.address, SETTINGS.MARKET, accounts[0])
        })

        it('only market can transfer tokens', async () => {
          await entityToken.transfer(accounts[1], 1).should.be.fulfilled
          await entityToken.transfer(accounts[0], 1, { from: accounts[1] }).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('only market can be approved for transfers', async () => {
          await entityToken.approve(accounts[0], 1).should.be.fulfilled
          await entityToken.approve(accounts[1], 1).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('transfers must be non-zero', async () => {
          await entityToken.transfer(accounts[1], 0).should.be.rejectedWith('cannot transfer zero')
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
          await market.executeLimitOffer(etherToken.address, 1000, tokenInfo.tokenContract_, 500, FEE_SCHEDULE_STANDARD)

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

        it('cannot be burnt if zero', async () => {
          await entity.burnTokens(0).should.be.rejectedWith('cannot burn zero')
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

          await entity.getTokenInfo().should.eventually.matchObj({
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
          await entityToken.balanceOf(entity.address).should.eventually.eq(0) // market sends cancelled back to entity - ensure we burn these too!
        })

        it('and re-uses existing token if new sale is initiated', async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager }).should.be.fulfilled

          const prevTokenInfo = await entity.getTokenInfo()

          await entity.cancelTokenSale({ from: entityManager }).should.be.fulfilled

          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

          await entity.getTokenInfo().should.eventually.matchObj({
            tokenContract_: prevTokenInfo.tokenContract_
          })
        })
      })

      describe('and funds withdrawals are prevented', () => {
        beforeEach(async () => {
          await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })
          
          await etherToken.deposit({ value: 1000 })
          await etherToken.approve(entity.address, 1000)
          await entity.deposit(etherToken.address, 1000)
        })
        
        it('when token supply is non-zero', async () => {
          await entity.withdraw(etherToken.address, 1, { from: entityAdmin }).should.be.rejectedWith('cannot withdraw while tokens exist')
        })

        it('once token supply is non-zero', async () => {
          await entity.cancelTokenSale({ from: entityManager })
          await entity.withdraw(etherToken.address, 1, { from: entityAdmin }).should.be.fulfilled
        })
      })
    })
  })

  describe('token holder tracking', () => {
    let entityManager
    let entityToken

    beforeEach(async () => {
      entityManager = accounts[2]

      await acl.assignRole(entityContext, entityManager, ROLES.ENTITY_MANAGER)

      await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

      await entity.getNumTokenHolders().should.eventually.eq(1)
      await entity.getTokenHolderAtIndex(1).should.eventually.eq(market.address)

      await etherToken.deposit({ value: 500 })
      await etherToken.approve(market.address, 500)
      const tokenInfo = await entity.getTokenInfo()

      await market.executeLimitOffer(etherToken.address, 500, tokenInfo.tokenContract_, 250, FEE_SCHEDULE_STANDARD)

      // after some has been sold the market and buyer are the present holders
      await entity.getNumTokenHolders().should.eventually.eq(2)
      await entity.getTokenHolderAtIndex(1).should.eventually.eq(market.address)
      await entity.getTokenHolderAtIndex(2).should.eventually.eq(accounts[0])

      entityToken = await IERC20.at(tokenInfo.tokenContract_)

      await entityToken.balanceOf(accounts[0]).should.eventually.eq(250)
      await entityToken.balanceOf(market.address).should.eventually.eq(250)
      await etherToken.balanceOf(entity.address).should.eventually.eq(500)
      await entity.getBalance(etherToken.address).should.eventually.eq(500)
    })

    it('ensures entity is not a holder after token sale is complete', async () => {
      // now cancel the token sale
      await entity.cancelTokenSale({ from: entityManager })

      // only the buyer should be a holder
      await entity.getNumTokenHolders().should.eventually.eq(1)
      await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[0])
    })

    describe('between accounts', () => {
      beforeEach(async () => {
        await entity.cancelTokenSale({ from: entityManager })

        // temp set accounts[0] as market so that we can send tokens around
        await settings.setAddress(settings.address, SETTINGS.MARKET, accounts[0])
      })

      it('works for a single holder', async () => {
        await entity.getNumTokenHolders().should.eventually.eq(1)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[0])
      })

      it('works for multiple holders', async () => {
        await entityToken.transfer(accounts[1], 1)
        await entityToken.transfer(accounts[2], 1)

        await entity.getNumTokenHolders().should.eventually.eq(3)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[0])
        await entity.getTokenHolderAtIndex(2).should.eventually.eq(accounts[1])
        await entity.getTokenHolderAtIndex(3).should.eventually.eq(accounts[2])
      })

      it('removes holder once their balance goes to zero', async () => {
        await entityToken.transfer(accounts[1], 1)

        await entity.getNumTokenHolders().should.eventually.eq(2)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[0])
        await entity.getTokenHolderAtIndex(2).should.eventually.eq(accounts[1])

        await entityToken.transfer(accounts[1], 249)

        await entity.getNumTokenHolders().should.eventually.eq(1)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[1])
      })

      it('re-adds holder if their balance goes to zero but then goes back up again', async () => {
        await entityToken.transfer(accounts[1], 250)

        await entity.getNumTokenHolders().should.eventually.eq(1)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[1])

        await entityToken.transferFrom(accounts[1], accounts[0], 100)

        await entity.getNumTokenHolders().should.eventually.eq(2)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[1])
        await entity.getTokenHolderAtIndex(2).should.eventually.eq(accounts[0])
      })

      it('removes holder if their balance gets burnt', async () => {
        await entityToken.transfer(accounts[1], 249)

        await entity.burnTokens(1, { from: accounts[1] })

        await entity.getNumTokenHolders().should.eventually.eq(2)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[0])
        await entity.getTokenHolderAtIndex(2).should.eventually.eq(accounts[1])

        await entity.burnTokens(248, { from: accounts[1] })

        await entity.getNumTokenHolders().should.eventually.eq(1)
        await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[0])
      })
    })
  })

  describe('dividend payouts', () => {
    let entityManager
    let entityToken

    beforeEach(async () => {
      entityManager = accounts[2]
      
      await acl.assignRole(entityContext, entityManager, ROLES.ENTITY_MANAGER)

      await entity.startTokenSale(500, etherToken.address, 1000, { from: entityManager })

      await etherToken.deposit({ value: 500 })
      await etherToken.approve(market.address, 500)
      const tokenInfo = await entity.getTokenInfo()
      await market.executeLimitOffer(etherToken.address, 500, tokenInfo.tokenContract_, 250, FEE_SCHEDULE_STANDARD)

      entityToken = await IERC20.at(tokenInfo.tokenContract_)
      
      await entityToken.balanceOf(accounts[0]).should.eventually.eq(250)
      await entityToken.balanceOf(market.address).should.eventually.eq(250)
      await entity.getBalance(etherToken.address).should.eventually.eq(500)

      await entity.cancelTokenSale({ from: entityManager })

      await entityToken.balanceOf(accounts[0]).should.eventually.eq(250)
      await entityToken.balanceOf(market.address).should.eventually.eq(0)
      await entity.getNumTokenHolders().should.eventually.eq(1)
      await entity.getTokenHolderAtIndex(1).should.eventually.eq(accounts[0])
    })

    it('cannot happen when token sale is in progress', async () => {
      await entity.startTokenSale(1, etherToken.address, 1, { from: entityManager })
      await entity.payDividend(etherToken.address, 1).should.be.rejectedWith('token sale in progress')
      await entity.cancelTokenSale({ from: entityManager })
      await entity.payDividend(etherToken.address, 1).should.be.fulfilled
    })

    describe('with multiple holders', async () => {
      beforeEach(async () => {
        // temp set accounts[0] as market so that we can send tokens around
        await settings.setAddress(settings.address, SETTINGS.MARKET, accounts[0])

        await entityToken.transfer(accounts[1], 100)

        // check balances
        await entityToken.balanceOf(accounts[0]).should.eventually.eq(150)
        await entityToken.balanceOf(accounts[1]).should.eventually.eq(100)
        await entityToken.totalSupply().should.eventually.eq(250)
        await entity.getNumTokenHolders().should.eventually.eq(2)
      })

      it('must not exceed entity balance', async () => {
        await entity.payDividend(etherToken.address, 501).should.be.rejectedWith('exceeds entity balance')
      })

      it('get allocated proportionately to holders', async () => {
        await entity.payDividend(etherToken.address, 500)

        await entity.getBalance(etherToken.address).should.eventually.eq(0)
        await entity.getWithdrawableDividend(etherToken.address, accounts[0]).should.eventually.eq(300)
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(200)
      })

      it('add to previous payouts', async () => {
        await entity.payDividend(etherToken.address, 100)

        await entity.getBalance(etherToken.address).should.eventually.eq(400)
        await entity.getWithdrawableDividend(etherToken.address, accounts[0]).should.eventually.eq(60)
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(40)

        await entity.payDividend(etherToken.address, 50)

        await entity.getBalance(etherToken.address).should.eventually.eq(350)
        await entity.getWithdrawableDividend(etherToken.address, accounts[0]).should.eventually.eq(90)
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(60)
      })

      it('can be withdrawn', async () => {
        await entity.payDividend(etherToken.address, 100)

        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(40)

        await entity.withdrawDividend(etherToken.address, { from: accounts[1] })

        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(0)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(40)
      })

      it('can be withdrawn even if 0', async () => {
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(0)
        await entity.withdrawDividend(etherToken.address, { from: accounts[1] })
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(0)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(0)
      })

      it('can be withdrawn even after holder has given tokens away', async () => {
        await entity.payDividend(etherToken.address, 100)

        await entity.getWithdrawableDividend(etherToken.address, accounts[0]).should.eventually.eq(60)
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(40)

        // send all tokens back to accounts[0]
        await entityToken.transferFrom(accounts[1], accounts[0], 100)

        await entity.payDividend(etherToken.address, 50)

        await entity.getWithdrawableDividend(etherToken.address, accounts[0]).should.eventually.eq(110)
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(40)

        // now withdraw
        await entity.withdrawDividend(etherToken.address, { from: accounts[1] })
        await entity.getWithdrawableDividend(etherToken.address, accounts[1]).should.eventually.eq(0)
        await etherToken.balanceOf(accounts[1]).should.eventually.eq(40)
      })
    })
  })

  describe('policies can be created', () => {
    let entityManager
    let entityRep

    beforeEach(async () => {
      entityManager = accounts[2]
      entityRep = accounts[3]

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
      await entity.getNumChildren().should.eventually.eq(0)

      const result = await createPolicy(entity, {}, { from: entityRep })
      const eventArgs = extractEventArgs(result, events.NewPolicy)

      await entity.getNumChildren().should.eventually.eq(1)
      await entity.getChild(1).should.eventually.eq(eventArgs.policy)
      await entity.hasChild(eventArgs.policy).should.eventually.eq(true)
      ;(await IPolicy.at(eventArgs.policy)).getParent().should.eventually.eq(entity.address)

      const result2 = await createPolicy(entity, {}, { from: entityRep })
      const eventArgs2 = extractEventArgs(result2, events.NewPolicy)

      await entity.getNumChildren().should.eventually.eq(2)
      await entity.getChild(2).should.eventually.eq(eventArgs2.policy)
      await entity.hasChild(eventArgs2.policy).should.eventually.eq(true)
        ; (await IPolicy.at(eventArgs2.policy)).getParent().should.eventually.eq(entity.address)
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
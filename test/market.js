import {
  extractEventArgs,
  ADDRESS_ZERO,
  createTranch,
} from './utils'

import { events } from '../'

import { ensureEtherTokenIsDeployed } from '../migrations/utils/etherToken'

import {
  ensureAclIsDeployed,
  ROLE_ENTITY_MANAGER,
  ROLE_ASSET_MANAGER,
} from '../migrations/utils/acl'

import { ensureSettingsIsDeployed } from '../migrations/utils/settings'

const EntityDeployer = artifacts.require('./EntityDeployer')
const IEntityImpl = artifacts.require('./base/IEntityImpl')
const EntityImpl = artifacts.require('./EntityImpl')
const Entity = artifacts.require('./Entity')
const IPolicyImpl = artifacts.require("./base/IPolicyImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const Policy = artifacts.require("./Policy")
const IERC20 = artifacts.require("./base/IERC20")
const Market = artifacts.require("./MatchingMarket")

contract('Market', accounts => {
  let acl
  let settings
  let policyImpl
  let policyProxy
  let policy
  let market
  let etherToken
  let tranchToken
  let entityManagerAddress
  let policyApproverAddress

  beforeEach(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    // wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)

    // entity
    const entityImpl = await EntityImpl.new(acl.address, settings.address)
    const entityDeployer = await EntityDeployer.new(acl.address, settings.address, entityImpl.address)

    const deployEntityTx = await entityDeployer.deploy('acme')
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    const entityProxy = await Entity.at(entityAddress)
    const entity = await IEntityImpl.at(entityAddress)
    const entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(entityContext, accounts[1], ROLE_ENTITY_MANAGER)
    entityManagerAddress = accounts[1]

    policyImpl = await PolicyImpl.new(acl.address, settings.address)

    const createPolicyTx = await entity.createPolicy(policyImpl.address, 'doom', { from: entityManagerAddress })
    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicyImpl.at(policyAddress)
    const policyContext = await policyProxy.aclContext()

    // get market address
    market = await Market.new('0xFFFFFFFFFFFFFFFF')

    // authorize market as operator for eth token
    await etherToken.setAllowedTransferOperator(market.address, true)

    // save market to settings
    await settings.setMatchingMarket(market.address)

    // setup one tranch with 100 shares at 1 WEI per share
    await createTranch(policy, {
      numShares: 100,
      pricePerShareAmount: 2,
      denominationUnit: etherToken.address,
    }, { from: entityManagerAddress })
    const ta = await policy.getTranchToken(0)
    tranchToken = await IERC20.at(ta)

    await acl.assignRole(policyContext, accounts[2], ROLE_ASSET_MANAGER)
    policyApproverAddress = accounts[2]
  })

  describe('tranches begin selling', async () => {
    it('but not by an unauthorized person', async () => {
      await policy.beginTranchSale(0).should.be.rejectedWith('must be policy approver')
    })

    it('but not if initial allocation is not to parent policy', async () => {
      await createTranch(policy, {
        numShares: 100,
        pricePerShareAmount: 2,
        denominationUnit: etherToken.address,
        initialBalanceHolder: accounts[3],
      }, { from: entityManagerAddress })

      await policy.beginTranchSale(1, { from: policyApproverAddress }).should.be.rejectedWith('initial holder must be policy contract')
    })

    it('by an authorized person', async () => {
      await tranchToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(100)

      const result = await policy.beginTranchSale(0, { from: policyApproverAddress })

      expect(extractEventArgs(result, events.BeginTranchSale)).to.include({
        tranch: '0',
        amount: '100',
        price: '200',
        unit: etherToken.address,
      })

      await tranchToken.balanceOf(market.address).should.eventually.eq(100)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
    })

    it('and their state is set to SELLING', async () => {
      await policy.beginTranchSale(0, { from: policyApproverAddress })
      await policy.getTranchStatus(0).should.eventually.eq(await policy.STATE_SELLING())
    })

    it('and can only do this once', async () => {
      await policy.beginTranchSale(0, { from: policyApproverAddress }).should.be.fulfilled
      await policy.beginTranchSale(0, { from: policyApproverAddress }).should.be.rejectedWith('sale already started')
    })
  })

  describe('once a tranch begins trading', () => {
    beforeEach(async () => {
      await policy.beginTranchSale(0, { from: policyApproverAddress })
      await etherToken.deposit({ from: accounts[2], value: 25 })
    })

    it('another party can make an offer that does not match', async () => {
      // check initial balances
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
      await etherToken.balanceOf(policy.address).should.eventually.eq(0)
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)

      // // make the offer on the market
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      await market.offer(10, etherToken.address, 5000, tranchToken.address, 0, true, { from: accounts[2] })

      // check balances again
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
      await etherToken.balanceOf(policy.address).should.eventually.eq(0)
      await etherToken.balanceOf(market.address).should.eventually.eq(10)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)
    })

    it('another party can make an offer that does match', async () => {
      // check initial balances
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(25)
      await etherToken.balanceOf(policy.address).should.eventually.eq(0)
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(0)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(100)

      // make the offer on the market
      await etherToken.approve(market.address, 10, { from: accounts[2] })
      await market.offer(10, etherToken.address, 5, tranchToken.address, 0, true, { from: accounts[2] })

      // check balances again
      await etherToken.balanceOf(accounts[2]).should.eventually.eq(15)
      await etherToken.balanceOf(policy.address).should.eventually.eq(10)
      await etherToken.balanceOf(market.address).should.eventually.eq(0)
      await tranchToken.balanceOf(accounts[2]).should.eventually.eq(5)
      await tranchToken.balanceOf(policy.address).should.eventually.eq(0)
      await tranchToken.balanceOf(market.address).should.eventually.eq(95)
    })
  })
})

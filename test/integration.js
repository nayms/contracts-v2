import {
  extractEventArgs,
  createTranch,
  createPolicy,
  EvmClock,
  calcPremiumsMinusCommissions,
  calcCommissions,
  EvmSnapshot,
} from './utils'
import { events } from '../'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ROLES, SETTINGS } from '../utils/constants'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IPolicy = artifacts.require('./base/IPolicy')
const IPolicyStates = artifacts.require('./base/IPolicyStates')
const Policy = artifacts.require('./Policy')


contract('End-to-end integration tests', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let settings
  let etherToken
  let entityImpl
  let entityDeployer
  let policyCoreAddress
  let market

  let systemAdmin
  let systemContext
  let systemManager

  let entity0Address
  let entity0
  let entity0Proxy
  let entity0Context
  let entity0Admin
  let entity0Manager
  let entity0Rep1
  let entity0Rep2

  let entity1Address
  let entity1
  let entity1Proxy
  let entity1Context
  let entity1Admin
  let entity1Manager
  let entity1Rep1
  let entity1Rep2

  let entity2Address
  let entity2
  let entity2Proxy
  let entity2Context
  let entity2SoleProp

  let entity3Address
  let entity3
  let entity3Proxy
  let entity3Context
  let entity3Naym

  let POLICY_STATE_CREATED
  let POLICY_STATE_SELLING
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let TRANCH_STATE_CREATED
  let TRANCH_STATE_SELLING
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED
  let TRANCH_STATE_CANCELLED

  let calcTime
  let setupEntities

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    calcTime = async deltaSeconds => {
      const t = await settings.getTime()
      const s = parseInt(t.toString(10))
      return s + deltaSeconds
    }

    // wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)
    // entities
    await ensureEntityImplementationsAreDeployed({ artifacts }, acl.address, settings.address)
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts }, acl.address, settings.address)
    // policies
    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address))
    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_SELLING = await policyStates.POLICY_STATE_SELLING()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    TRANCH_STATE_CREATED = await policyStates.TRANCH_STATE_CREATED()
    TRANCH_STATE_SELLING = await policyStates.TRANCH_STATE_SELLING()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
    // market
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)

    systemAdmin = accounts[0]
    systemContext = await acl.systemContext()

    setupEntities = async () => {
      // Test case 1....

      // step3: assign system manager
      await acl.assignRole(systemContext, accounts[1], ROLES.SYSTEM_MANAGER, { from: systemAdmin })
      systemManager = accounts[1]

      // step 4: create entity0
      let deployEntityTx = await entityDeployer.deploy({ from: systemManager })
      entity0Address = extractEventArgs(deployEntityTx, events.NewEntity).entity
      entity0 = await IEntity.at(entity0Address)
      entity0Proxy = await Entity.at(entity0Address)
      entity0Context = await entity0Proxy.aclContext()
      // step 5: assign role
      await acl.assignRole(entity0Context, accounts[2], ROLES.ENTITY_ADMIN, { from: systemManager })
      entity0Admin = accounts[2]
      // step 6: assign role
      await acl.assignRole(entity0Context, accounts[3], ROLES.ENTITY_MANAGER, { from: entity0Admin })
      entity0Manager = accounts[3]
      // step 7: assign role
      await acl.assignRole(entity0Context, accounts[4], ROLES.ENTITY_REP, { from: entity0Manager })
      entity0Rep1 = accounts[4]
      // step 8: assign role
      await acl.assignRole(entity0Context, accounts[5], ROLES.ENTITY_REP, { from: entity0Manager })
      entity0Rep2 = accounts[5]

      // step 9: create entity1
      deployEntityTx = await entityDeployer.deploy({ from: systemManager })
      entity1Address = extractEventArgs(deployEntityTx, events.NewEntity).entity
      entity1 = await IEntity.at(entity1Address)
      entity1Proxy = await Entity.at(entity1Address)
      entity1Context = await entity1Proxy.aclContext()
      // step 10: assign role
      await acl.assignRole(entity1Context, accounts[6], ROLES.ENTITY_ADMIN, { from: systemManager })
      entity1Admin = accounts[6]
      // step 11: assign role
      await acl.assignRole(entity1Context, accounts[7], ROLES.ENTITY_MANAGER, { from: entity1Admin })
      entity1Manager = accounts[7]
      // step 12: assign role
      await acl.assignRole(entity1Context, accounts[8], ROLES.ENTITY_REP, { from: entity1Manager })
      entity1Rep1 = accounts[8]
      // step 13: assign role
      await acl.assignRole(entity1Context, accounts[9], ROLES.ENTITY_REP, { from: entity1Manager })
      entity1Rep2 = accounts[9]

      // step 14: create entity2
      deployEntityTx = await entityDeployer.deploy({ from: systemManager })
      entity2Address = extractEventArgs(deployEntityTx, events.NewEntity).entity
      entity2 = await IEntity.at(entity2Address)
      entity2Proxy = await Entity.at(entity2Address)
      entity2Context = await entity2Proxy.aclContext()
      // step 15: assign role
      await acl.assignRole(entity2Context, accounts[10], ROLES.SOLE_PROP, { from: systemManager })
      entity2SoleProp = accounts[10]

      // step 16: create entity3
      deployEntityTx = await entityDeployer.deploy({ from: systemManager })
      entity3Address = extractEventArgs(deployEntityTx, events.NewEntity).entity
      entity3 = await IEntity.at(entity3Address)
      entity3Proxy = await Entity.at(entity3Address)
      entity3Context = await entity3Proxy.aclContext()
      // step 15: assign role
      await acl.assignRole(entity3Context, accounts[11], ROLES.NAYM, { from: systemManager })
      entity3Naym = accounts[11]
    }

    await setupEntities()
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('test case 1', async () => {
    /* https://docs.google.com/spreadsheets/d/1LEvfJvNutmXsdKk9SO0vBzAmpepFMf8188kgAvYFCc8/edit#gid=0 */

    // nothing to as, the before() script basically already does this
    // await setupEntities()
  })

  it('test case 2', async () => {
    /* https://docs.google.com/spreadsheets/d/1LEvfJvNutmXsdKk9SO0vBzAmpepFMf8188kgAvYFCc8/edit#gid=455876604 */

    // step 1: deposit WETH
    await etherToken.deposit({ value: 110, from: entity0Admin })
    await etherToken.approve(entity0Address, 110, { from: entity0Admin })
    await entity0.deposit(etherToken.address, 110, { from: entity0Admin })

    // step 2: deposit WETH
    await etherToken.deposit({ value: 60, from: entity2SoleProp })
    await etherToken.approve(entity2Address, 60, { from: entity2SoleProp })
    await entity2.deposit(etherToken.address, 60, { from: entity2SoleProp })

    // step 3: deposit WETH
    await etherToken.deposit({ value: 30, from: entity3Naym })
    await etherToken.approve(entity3Address, 30, { from: entity3Naym })
    await entity3.deposit(etherToken.address, 30, { from: entity3Naym })

    let entity0Balance = 110
    let entity1Balance = 0
    let entity2Balance = 60
    let entity3Balance = 30

    // step 4: create policyImpl1
    await createPolicy(
      entity0,
      {
        initiationDate: await calcTime(5 * 60),
        startDate: await calcTime(10 * 60),
        maturationDate: await calcTime(25 * 60),
        unit: etherToken.address,
        premiumIntervalSeconds: 5 * 60,
        /* basis points: 1 = 0.1% */
        brokerCommissionBP: 1,
        assetManagerCommissionBP: 2,
        naymsCommissionBP: 3,
      },
      {
        from: entity0Manager
      }
    )
    const policy1Address = await entity0.getPolicy(0)
    const policy1Proxy = await Policy.at(policy1Address)
    const policy1Context = await policy1Proxy.aclContext()
    const policy1 = await IPolicy.at(policy1Address)
    const policy1Owner = entity0Manager

    // set baseline time
    const evmClock = new EvmClock()

    // steps 5-7: assign roles
    await acl.assignRole(policy1Context, accounts[4], ROLES.BROKER, { from: policy1Owner })
    await acl.assignRole(policy1Context, accounts[5], ROLES.ASSET_MANAGER, { from: policy1Owner })
    await acl.assignRole(policy1Context, accounts[8], ROLES.CLIENT_MANAGER, { from: policy1Owner })
    const policy1Broker = accounts[4]
    const policy1AssetManager = accounts[5]
    const policy1ClientManager = accounts[8]

    // step 8: create tranch policy1Tranch1
    await createTranch(
      policy1,
      {
        numShares: 100,
        pricePerShareAmount: 1,
        premiums: [ 1000, 2000, 1000 ],
      },
      {
        from: policy1Owner,
      }
    )
    const { token_: policy1Tranch1Address } = await policy1.getTranchInfo(0)

    // steps 9-13: skip for now

    // step 14: client manager pays first premium for policy1Tranch1
    await etherToken.deposit({ value: 1000, from: policy1ClientManager })
    await etherToken.approve(entity1.address, 1000, { from: policy1ClientManager })
    await entity1.deposit(etherToken.address, 1000, { from: policy1ClientManager })
    await entity1.payTranchPremium(policy1.address, 0, { from: policy1ClientManager })

    // step 15: heartbeat - begin sale of policy1Tranch1
    await evmClock.setAbsoluteTime(5 * 60)
    await policy1.checkAndUpdateState()

    // check states
    await policy1.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING })
    await policy1.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_SELLING
    })

    // step 16: trader buys 50 shares of policy1Tranch1 via entity0
    await entity0.trade(
      etherToken.address, 50,
      policy1Tranch1Address, 50,
      { from: entity0Rep1 }
    )
    entity0Balance -= 50

    // step 17: trader buys 25 shares of policy1Tranch1 via entity2
    await entity2.trade(
      etherToken.address, 25,
      policy1Tranch1Address, 25,
      { from: entity2SoleProp }
    )
    entity2Balance -= 25

    // step 18: trader buys 25 shares of policy1Tranch1 via entity3
    await entity3.trade(
      etherToken.address, 25,
      policy1Tranch1Address, 25,
      { from: entity3Naym }
    )
    entity3Balance -= 25

    // sanity check balances
    await etherToken.balanceOf(entity0Address).should.eventually.eq(entity0Balance)
    await etherToken.balanceOf(entity2Address).should.eventually.eq(entity2Balance)
    await etherToken.balanceOf(entity3Address).should.eventually.eq(entity3Balance)

    // check states
    await policy1.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING }) // pending since start date not yet passed
    await policy1.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE  // should be active since it's fully sold out
    })

    // step 19: client manager pays second premium for policy1Tranch1
    await evmClock.setAbsoluteTime(9 * 60)
    await etherToken.deposit({ value: 2000, from: policy1ClientManager })
    await etherToken.approve(entity1.address, 2000, { from: policy1ClientManager })
    await entity1.deposit(etherToken.address, 2000, { from: policy1ClientManager })
    await entity1.payTranchPremium(policy1.address, 0, { from: policy1ClientManager })

    // step 20: heartbeat
    await evmClock.setAbsoluteTime(10 * 60)
    await policy1.checkAndUpdateState()
    await policy1.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE }) // active now since startdate has passed
    await policy1.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE
    })

    // step 21: skip for now

    // step 22: client manager pays third premium for policy1Tranch1
    await evmClock.setAbsoluteTime(14 * 60)
    await etherToken.deposit({ value: 1000, from: policy1ClientManager })
    await etherToken.approve(entity1.address, 1000, { from: policy1ClientManager })
    await entity1.deposit(etherToken.address, 1000, { from: policy1ClientManager })
    await entity1.payTranchPremium(policy1.address, 0, { from: policy1ClientManager })

    // step 23: heartbeat
    await evmClock.setAbsoluteTime(15 * 60)
    await policy1.checkAndUpdateState()
    await policy1.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
    await policy1.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE
    })

    // step 24: heartbeat
    await evmClock.setAbsoluteTime(20 * 60)
    await policy1.checkAndUpdateState()
    await policy1.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
    await policy1.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE // all premium payments are done so all ok!
    })

    // step 25: heartbeat
    await evmClock.setAbsoluteTime(25 * 60)
    await policy1.checkAndUpdateState()
    await policy1.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
    await policy1.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_MATURED
    })

    // sanity check balances
    const policy1Tranch1ExpectedBalance = 100 + calcPremiumsMinusCommissions({
      premiums: [1000, 2000, 1000],
      assetManagerCommissionBP: 2,
      brokerCommissionBP: 1,
      naymsCommissionBP: 3,
    })
    expect(policy1Tranch1ExpectedBalance).to.eq(4076)
    await policy1.getTranchInfo(0).should.eventually.matchObj({
      balance_: policy1Tranch1ExpectedBalance
    })
    const expectedCommissions = calcCommissions({
      premiums: [1000, 2000, 1000],
      assetManagerCommissionBP: 2,
      brokerCommissionBP: 1,
      naymsCommissionBP: 3,
    })
    expect(expectedCommissions.assetManagerCommission).to.eq(8)
    expect(expectedCommissions.brokerCommission).to.eq(4)
    expect(expectedCommissions.naymsCommission).to.eq(12)
    await policy1.getCommissionBalances().should.eventually.matchObj({
      assetManagerCommissionBalance_: expectedCommissions.assetManagerCommission,
      brokerCommissionBalance_: expectedCommissions.brokerCommission,
      naymsCommissionBalance_: expectedCommissions.naymsCommission,
    })

    // step 26: withdraw commission payments (both asset manager and broker belong to entity0 so we'll use that one!)
    await policy1.payCommissions(entity0Address, policy1AssetManager, entity0Address, policy1Broker)

    // sanity check nayms entity balance
    const naymsEntityAddress = await settings.getRootAddress(SETTINGS.NAYMS_ENTITY)
    await etherToken.balanceOf(naymsEntityAddress).should.eventually.eq(expectedCommissions.naymsCommission)
    const entity0ExpectedBalance = entity0Balance + expectedCommissions.assetManagerCommission + expectedCommissions.brokerCommission
    await etherToken.balanceOf(entity0Address).should.eventually.eq(entity0ExpectedBalance)
    entity0Balance = entity0ExpectedBalance

    // step 27: trader sells policy1Tranch1 tokens via entity0
    await entity0.sellAtBestPrice(
      policy1Tranch1Address, 50,
      etherToken.address,
      { from: entity0Rep1 }
    )
    const entity0FinalBalance = entity0Balance + 0.5 * policy1Tranch1ExpectedBalance
    await etherToken.balanceOf(entity0.address).should.eventually.eq(entity0FinalBalance)

    // step 28: skip for now

    // step 29: trader sells policy1Tranch1 tokens via entity2
    await entity2.sellAtBestPrice(
      policy1Tranch1Address, 25,
      etherToken.address,
      { from: entity2SoleProp }
    )
    const entity2FinalBalance = entity2Balance + 0.25 * policy1Tranch1ExpectedBalance
    await etherToken.balanceOf(entity2.address).should.eventually.eq(entity2FinalBalance)

    // step 30: skip for now

    // step 31: trader sells policy1Tranch1 tokens via entity3
    await entity3.sellAtBestPrice(
      policy1Tranch1Address, 25,
      etherToken.address,
      { from: entity3Naym }
    )
    const entity3FinalBalance = entity3Balance + 0.25 * policy1Tranch1ExpectedBalance
    await etherToken.balanceOf(entity3Address).should.eventually.eq(entity3FinalBalance)

    // step 32: withdraw from entity0
    await entity0.withdraw(etherToken.address, entity0FinalBalance, { from: entity0Admin })
    await etherToken.balanceOf(entity0Admin).should.eventually.eq(entity0FinalBalance)

    // step 33: withdraw from entity2
    await entity2.withdraw(etherToken.address, entity2FinalBalance, { from: entity2SoleProp })
    await etherToken.balanceOf(entity2SoleProp).should.eventually.eq(entity2FinalBalance)

    // step 34: withdraw from entity3
    await entity3.withdraw(etherToken.address, entity3FinalBalance, { from: entity3Naym })
    await etherToken.balanceOf(entity3Naym).should.eventually.eq(entity3FinalBalance)
  })

  it('test case 3', async () => {
    /* https://docs.google.com/spreadsheets/d/1LEvfJvNutmXsdKk9SO0vBzAmpepFMf8188kgAvYFCc8/edit#gid=1017355124 */

    // step 1: deposit WETH
    await etherToken.deposit({ value: 110, from: entity0Admin })
    await etherToken.approve(entity0Address, 110, { from: entity0Admin })
    await entity0.deposit(etherToken.address, 110, { from: entity0Admin })

    // step 2: deposit WETH
    await etherToken.deposit({ value: 60, from: entity2SoleProp })
    await etherToken.approve(entity2Address, 60, { from: entity2SoleProp })
    await entity2.deposit(etherToken.address, 60, { from: entity2SoleProp })

    // step 3: deposit WETH
    await etherToken.deposit({ value: 30, from: entity3Naym })
    await etherToken.approve(entity3Address, 30, { from: entity3Naym })
    await entity3.deposit(etherToken.address, 30, { from: entity3Naym })

    let entity0Balance = 110
    let entity1Balance = 0
    let entity2Balance = 60
    let entity3Balance = 30

    // step 4: create policy2
    await createPolicy(
      entity0,
      {
        initiationDate: await calcTime(5 * 60),
        startDate: await calcTime(10 * 60),
        maturationDate: await calcTime(25 * 60),
        unit: etherToken.address,
        premiumIntervalSeconds: 5 * 60,
        /* basis points: 1 = 0.1% */
        brokerCommissionBP: 1,
        assetManagerCommissionBP: 2,
        naymsCommissionBP: 3,
      },
      {
        from: entity0Manager
      }
    )
    const policy2Address = await entity0.getPolicy(0)
    const policy2Proxy = await Policy.at(policy2Address)
    const policy2Context = await policy2Proxy.aclContext()
    const policy2 = await IPolicy.at(policy2Address)
    const policy2Owner = entity0Manager

    // set baseline time
    const evmClock = new EvmClock()

    // steps 5-7: assign roles
    await acl.assignRole(policy2Context, accounts[4], ROLES.BROKER, { from: policy2Owner })
    await acl.assignRole(policy2Context, accounts[5], ROLES.ASSET_MANAGER, { from: policy2Owner })
    await acl.assignRole(policy2Context, accounts[8], ROLES.CLIENT_MANAGER, { from: policy2Owner })
    const policy2Broker = accounts[4]
    const policy2AssetManager = accounts[5]
    const policy2ClientManager = accounts[8]

    // step 8: create tranch policy2Tranch1
    await createTranch(
      policy2,
      {
        numShares: 100,
        pricePerShareAmount: 1,
        premiums: [1000, 2000, 1000],
      },
      {
        from: policy2Owner,
      }
    )
    const { token_: policy2Tranch1Address } = await policy2.getTranchInfo(0)

    // steps 9-13: skip for now

    // step 14: client manager pays first premium for policy2Tranch1
    await evmClock.setAbsoluteTime(3 * 60)
    await etherToken.deposit({ value: 1000, from: policy2ClientManager })
    await etherToken.approve(entity1.address, 1000, { from: policy2ClientManager })
    await entity1.deposit(etherToken.address, 1000, { from: policy2ClientManager })
    await entity1.payTranchPremium(policy2.address, 0, { from: policy2ClientManager })

    // step 15: heartbeat - begin sale of policy2Tranch1
    await evmClock.setAbsoluteTime(5 * 60)
    await policy2.checkAndUpdateState()

    // check states
    await policy2.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING })
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_SELLING
    })

    // step 16: trader buys 50 shares of policy2Tranch1 via entity0
    await entity0.trade(
      etherToken.address, 50,
      policy2Tranch1Address, 50,
      { from: entity0Rep1 }
    )
    entity0Balance -= 50

    // step 17: trader buys 50 shares of policy2Tranch1 via entity2
    await entity2.trade(
      etherToken.address, 50,
      policy2Tranch1Address, 50,
      { from: entity2SoleProp }
    )
    entity2Balance -= 50

    // sanity check balances
    await etherToken.balanceOf(entity0Address).should.eventually.eq(entity0Balance)
    await etherToken.balanceOf(entity2Address).should.eventually.eq(entity2Balance)

    // check states
    await policy2.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING }) // pending since start date not yet passed
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE // should be active since it's fully sold out
    })

    // steps 18-20: skip for now

    // step 21: client manager pays second premium for policy2Tranch1
    await evmClock.setAbsoluteTime(9 * 60)
    await etherToken.deposit({ value: 2000, from: policy2ClientManager })
    await etherToken.approve(entity1.address, 2000, { from: policy2ClientManager })
    await entity1.deposit(etherToken.address, 2000, { from: policy2ClientManager })
    await entity1.payTranchPremium(policy2.address, 0, { from: policy2ClientManager })

    // step 22: heartbeat
    await evmClock.setAbsoluteTime(10 * 60)
    await policy2.checkAndUpdateState()
    await policy2.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE }) // active now since startdate has passed
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE
    })

    // step 23: client manager pays third premium for policy2Tranch1
    await evmClock.setAbsoluteTime(14 * 60)
    await etherToken.deposit({ value: 1000, from: policy2ClientManager })
    await etherToken.approve(entity1.address, 1000, { from: policy2ClientManager })
    await entity1.deposit(etherToken.address, 1000, { from: policy2ClientManager })
    await entity1.payTranchPremium(policy2.address, 0, { from: policy2ClientManager })

    // step 24: heartbeat
    await evmClock.setAbsoluteTime(15 * 60)
    await policy2.checkAndUpdateState()
    await policy2.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE
    })

    // step 25: heartbeat
    await evmClock.setAbsoluteTime(20 * 60)
    await policy2.checkAndUpdateState()
    await policy2.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE // all premium payments are done so all ok!
    })

    // sanity check commission balances
    const expectedCommissions = calcCommissions({
      premiums: [1000, 2000, 1000],
      brokerCommissionBP: 1,
      assetManagerCommissionBP: 2,
      naymsCommissionBP: 3,
    })
    expect(expectedCommissions.assetManagerCommission).to.eq(8)
    expect(expectedCommissions.brokerCommission).to.eq(4)
    expect(expectedCommissions.naymsCommission).to.eq(12)
    await policy2.getCommissionBalances().should.eventually.matchObj({
      assetManagerCommissionBalance_: expectedCommissions.assetManagerCommission,
      brokerCommissionBalance_: expectedCommissions.brokerCommission,
      naymsCommissionBalance_: expectedCommissions.naymsCommission,
    })

    const policy2Tranch1ExpectedBalanceMinusCommissions = 100 + calcPremiumsMinusCommissions({
      premiums: [1000, 2000, 1000],
      brokerCommissionBP: 1,
      assetManagerCommissionBP: 2,
      naymsCommissionBP: 3,
    })

    // step 26: make claim on policy2Tranch1
    await evmClock.setAbsoluteTime(23 * 60)
    await policy2.makeClaim(0, entity1.address, 6, { from: policy2ClientManager })

    // step 27: heartbeat - policy matured but still have pending claims
    await evmClock.setAbsoluteTime(25 * 60)
    await policy2.checkAndUpdateState()
    await policy2.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_ACTIVE // got pending claims so state unchanged
    })

    // step 28: approve claim
    await evmClock.setAbsoluteTime(27 * 60)
    await policy2.approveClaim(0, { from: policy2AssetManager })

    // sanity check internal state
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      balance_: policy2Tranch1ExpectedBalanceMinusCommissions - 6
    })
    await policy2.getClaimInfo(0).should.eventually.matchObj({
      amount_: 6,
      approved_: true,
      paid_: false,
    })

    // step 29: heartbeat
    await policy2.checkAndUpdateState()
    await policy2.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      state_: TRANCH_STATE_MATURED
    })

    // sanity check tranch balance
    const policy2Tranch1ExpectedBalanceMinusCommissionsAndClaims = policy2Tranch1ExpectedBalanceMinusCommissions - 6
    expect(policy2Tranch1ExpectedBalanceMinusCommissionsAndClaims).to.eq(4070)
    await policy2.getTranchInfo(0).should.eventually.matchObj({
      balance_: policy2Tranch1ExpectedBalanceMinusCommissionsAndClaims
    })

    // step 30: pay out commissions
    await policy2.payCommissions(
      entity0Address, policy2AssetManager,
      entity0Address, policy2Broker,
    )

    // sanity check entity balances
    const naymsEntityAddress = await settings.getRootAddress(SETTINGS.NAYMS_ENTITY)
    await etherToken.balanceOf(naymsEntityAddress).should.eventually.eq(expectedCommissions.naymsCommission)
    const entity0ExpectedBalance = entity0Balance + expectedCommissions.assetManagerCommission + expectedCommissions.brokerCommission
    await etherToken.balanceOf(entity0Address).should.eventually.eq(entity0ExpectedBalance)
    entity0Balance = entity0ExpectedBalance

    // step 31: payout claims
    await evmClock.setAbsoluteTime(28 * 60)
    await policy2.payClaims()

    // check claim entity balance
    await etherToken.balanceOf(entity1Address).should.eventually.eq(entity1Balance + 6)
    entity1Balance += 5

    // step 32: trader sells policy2Tranch1 tokens via entity0
    await entity0.sellAtBestPrice(
      policy2Tranch1Address, 50,
      etherToken.address,
      { from: entity0Rep2 }
    )
    const entity0FinalBalance = entity0Balance + 0.5 * policy2Tranch1ExpectedBalanceMinusCommissionsAndClaims
    await etherToken.balanceOf(entity0Address).should.eventually.eq(entity0FinalBalance)

    // step 33: trader sells policy2Tranch1 tokens via entity2
    await entity2.sellAtBestPrice(
      policy2Tranch1Address, 50,
      etherToken.address,
      { from: entity2SoleProp }
    )
    const entity2FinalBalance = entity2Balance + 0.5 * policy2Tranch1ExpectedBalanceMinusCommissionsAndClaims
    await etherToken.balanceOf(entity2Address).should.eventually.eq(entity2FinalBalance)

    // steps 34-35: skip for now

    // step 36: withdraw from entity0
    await entity0.withdraw(etherToken.address, entity0FinalBalance, { from: entity0Admin })
    await etherToken.balanceOf(entity0Admin).should.eventually.eq(entity0FinalBalance)

    // step 33: withdraw from entity2
    await entity2.withdraw(etherToken.address, entity2FinalBalance, { from: entity2SoleProp })
    await etherToken.balanceOf(entity2SoleProp).should.eventually.eq(entity2FinalBalance)

    // step 34: withdraw from entity3
    const entity3FinalBalance = entity3Balance
    await entity3.withdraw(etherToken.address, entity3FinalBalance, { from: entity3Naym })
    await etherToken.balanceOf(entity3Naym).should.eventually.eq(entity3FinalBalance)  })
})

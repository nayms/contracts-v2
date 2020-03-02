import {
  extractEventArgs,
  ADDRESS_ZERO,
  createTranch,
  createPolicy,
  web3EvmIncreaseTime,
} from './utils'

import { events } from '../'
import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ROLES, ROLEGROUPS } from '../utils/constants'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureMarketIsDeployed } from '../migrations/modules/market'

const EntityDeployer = artifacts.require('./EntityDeployer')
const IEntityImpl = artifacts.require('./base/IEntityImpl')
const EntityImpl = artifacts.require('./EntityImpl')
const Entity = artifacts.require('./Entity')
const IPolicyImpl = artifacts.require('./base/IPolicyImpl')
const PolicyImpl = artifacts.require('./PolicyImpl')
const Policy = artifacts.require('./Policy')
const IERC20 = artifacts.require('./base/IERC20')

const getCurrentTime = settings => settings.getTime().then(v => parseInt(v.toString(10)))

contract('End-to-end integration tests', accounts => {
  let acl
  let settings
  let etherToken
  let entityImpl
  let entityDeployer
  let policyImpl
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

  let calcTime
  let setupEntities

  beforeEach(async () => {
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
    entityImpl = await EntityImpl.new(acl.address, settings.address)
    entityDeployer = await EntityDeployer.new(acl.address, settings.address, entityImpl.address)
    // policies
    policyImpl = await PolicyImpl.new(acl.address, settings.address)
    // market
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)

    systemAdmin = accounts[0]
    systemContext = await acl.systemContext()

    setupEntities = async () => {
      // Test case 1....

      // step3: assign system manager
      await acl.assignRole(systemContext, accounts[1], ROLES.SYSTEM_MANAGER, { from: systemAdmin })
      const systemManager = accounts[1]

      // step 4: create entity0
      await entityDeployer.deploy({ from: systemManager })
      entity0Address = await entityDeployer.getEntity(0)
      entity0 = await IEntityImpl.at(entity0Address)
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
      await entityDeployer.deploy({ from: systemManager })
      entity1Address = await entityDeployer.getEntity(1)
      entity1 = await IEntityImpl.at(entity1Address)
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
      await entityDeployer.deploy({ from: systemManager })
      entity2Address = await entityDeployer.getEntity(2)
      entity2 = await IEntityImpl.at(entity2Address)
      entity2Proxy = await Entity.at(entity2Address)
      entity2Context = await entity2Proxy.aclContext()
      // step 15: assign role
      await acl.assignRole(entity2Context, accounts[10], ROLES.SOLE_PROP, { from: systemManager })
      entity2SoleProp = accounts[10]

      // step 16: create entity3
      await entityDeployer.deploy({ from: systemManager })
      entity3Address = await entityDeployer.getEntity(3)
      entity3 = await IEntityImpl.at(entity3Address)
      entity3Proxy = await Entity.at(entity3Address)
      entity3Context = await entity3Proxy.aclContext()
      // step 15: assign role
      await acl.assignRole(entity3Context, accounts[11], ROLES.NAYM, { from: systemManager })
      entity3Naym = accounts[11]
    }
  })

  it('test case 1', async () => {
    await setupEntities()
  })

  it.only('test case 2', async () => {
    await setupEntities()

    // step 1: deposit WETH
    await etherToken.deposit({ value: 11, from: entity0Admin })
    await etherToken.approve(entity0Address, 11, { from: entity0Admin })
    await entity0.deposit(etherToken.address, 11, { from: entity0Admin })

    // step 2: deposit WETH
    await etherToken.deposit({ value: 6, from: entity2SoleProp })
    await etherToken.approve(entity2Address, 6, { from: entity2SoleProp })
    await entity2.deposit(etherToken.address, 6, { from: entity2SoleProp })

    // step 3: deposit WETH
    await etherToken.deposit({ value: 3, from: entity3Naym })
    await etherToken.approve(entity3Address, 3, { from: entity3Naym })
    await entity3.deposit(etherToken.address, 3, { from: entity3Naym })

    // step 4: create policy1
    await createPolicy(
      entity0,
      policyImpl.address,
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
    const policy1 = await IPolicyImpl.at(policy1Address)
    const policy1Owner = entity0Manager

    // steps 5: assign roles
    await acl.assignRole(policy1Context, accounts[4], ROLES.BROKER, { from: policy1Owner })
    await acl.assignRole(policy1Context, accounts[5], ROLES.ASSET_MANAGER, { from: policy1Owner })
    await acl.assignRole(policy1Context, accounts[8], ROLES.CLIENT_MANAGER, { from: policy1Owner })
    const policy1Broker = accounts[4]
    const policy1AssetManager = accounts[5]
    const policy1ClientManager = accounts[8]

    // step 8: create tranch11
    await createTranch(
      policy1,
      {
        numShares: 10,
        pricePerShareAmount: 1,
        premiums: [1, 2, 1],
      },
      {
        from: policy1Owner,
      }
    )

    // steps 9-14: skip for now

    // step 14: client manager pays first premium for tranche11
    await etherToken.deposit({ value: 1, from: policy1ClientManager })
    await etherToken.approve(policy1.address, 100, { from: policy1ClientManager })
    await policy1.payTranchPremium(0, { from: policy1ClientManager })

    // step 15: heartbeat - begin sale of tranche11
    await web3EvmIncreaseTime(web3, 5 * 60)
    await policy1.checkAndUpdateState()
  })
})

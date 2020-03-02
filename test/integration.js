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

  beforeEach(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)
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
  })

  it('test case 1', async () => {
    // step3: assign system manager
    await acl.assignRole(systemContext, accounts[1], ROLES.SYSTEM_MANAGER, { from: systemAdmin })
    const systemManager = accounts[1]

    // step 4: create entity0
    await entityDeployer.deploy({ from: systemManager })
    const entity0Address = await entityDeployer.getEntity(0)
    const entity0 = await IEntityImpl.at(entity0Address)
    const entity0Proxy = await Entity.at(entity0Address)
    const entity0Context = await entity0Proxy.aclContext()
    // step 5: assign role
    await acl.assignRole(entity0Context, accounts[2], ROLES.ENTITY_ADMIN, { from: systemManager })
    const entity0Admin = accounts[2]
    // step 6: assign role
    await acl.assignRole(entity0Context, accounts[3], ROLES.ENTITY_MANAGER, { from: entity0Admin })
    const entity0Manager = accounts[3]
    // step 7: assign role
    await acl.assignRole(entity0Context, accounts[4], ROLES.ENTITY_REP, { from: entity0Manager })
    const entity0Rep1 = accounts[4]
    // step 8: assign role
    await acl.assignRole(entity0Context, accounts[5], ROLES.ENTITY_REP, { from: entity0Manager })
    const entity0Rep2 = accounts[5]

    // step 9: create entity1
    await entityDeployer.deploy({ from: systemManager })
    const entity1Address = await entityDeployer.getEntity(1)
    const entity1 = await IEntityImpl.at(entity1Address)
    const entity1Proxy = await Entity.at(entity1Address)
    const entity1Context = await entity1Proxy.aclContext()
    // step 10: assign role
    await acl.assignRole(entity1Context, accounts[6], ROLES.ENTITY_ADMIN, { from: systemManager })
    const entity1Admin = accounts[6]
    // step 11: assign role
    await acl.assignRole(entity1Context, accounts[7], ROLES.ENTITY_MANAGER, { from: entity1Admin })
    const entity1Manager = accounts[7]
    // step 12: assign role
    await acl.assignRole(entity1Context, accounts[8], ROLES.ENTITY_REP, { from: entity1Manager })
    const entity1Rep1 = accounts[8]
    // step 13: assign role
    await acl.assignRole(entity1Context, accounts[9], ROLES.ENTITY_REP, { from: entity1Manager })
    const entity1Rep2 = accounts[9]

    // step 14: create entity2
    await entityDeployer.deploy({ from: systemManager })
    const entity2Address = await entityDeployer.getEntity(2)
    const entity2 = await IEntityImpl.at(entity2Address)
    const entity2Proxy = await Entity.at(entity2Address)
    const entity2Context = await entity2Proxy.aclContext()
    // step 15: assign role
    await acl.assignRole(entity2Context, accounts[10], ROLES.SOLE_PROP, { from: systemManager })
    const entity2SoleProp = accounts[10]

    // step 16: create entity3
    await entityDeployer.deploy({ from: systemManager })
    const entity3Address = await entityDeployer.getEntity(3)
    const entity3 = await IEntityImpl.at(entity3Address)
    const entity3Proxy = await Entity.at(entity3Address)
    const entity3Context = await entity3Proxy.aclContext()
    // step 15: assign role
    await acl.assignRole(entity3Context, accounts[11], ROLES.NAYM, { from: systemManager })
    const entity3Naym = accounts[11]
  })
})

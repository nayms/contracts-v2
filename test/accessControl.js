import EthVal from 'ethval'
import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils'
import { events } from '../'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ROLES, ROLEGROUPS } from '../utils/constants'

const AccessControl = artifacts.require("./base/AccessControl")

contract('AccessControl', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let accessControl
  let accessControlContext
  let otherContext

  before(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    accessControl = await AccessControl.new(acl.address)
    accessControlContext = await accessControl.aclContext()
    otherContext = await acl.generateContextFromAddress(accounts[5])
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('hasRole', async () => {
    await accessControl.hasRole(accounts[0], ROLES.SYSTEM_ADMIN).should.eventually.eq(true)
    await accessControl.hasRole(accounts[0], ROLES.SYSTEM_MANAGER).should.eventually.eq(false)
  })

  it('hasRoleWithContext', async () => {
    await accessControl.hasRoleWithContext(accessControlContext, accounts[0], ROLES.SYSTEM_ADMIN).should.eventually.eq(true)
    await accessControl.hasRoleWithContext(otherContext, accounts[0], ROLES.SYSTEM_MANAGER).should.eventually.eq(false)
  })

  it('inRoleGroup', async () => {
    await accessControl.inRoleGroup(accounts[0], ROLEGROUPS.SYSTEM_ADMINS).should.eventually.eq(true)
    await accessControl.inRoleGroup(accounts[0], ROLEGROUPS.SYSTEM_MANAGERS).should.eventually.eq(false)
  })

  it('inRoleGroupWithContext', async () => {
    await acl.assignRole(accessControlContext, accounts[1], ROLES.SYSTEM_MANAGER)
    await accessControl.inRoleGroupWithContext(accessControlContext, accounts[1], ROLEGROUPS.SYSTEM_MANAGERS).should.eventually.eq(true)
    await accessControl.inRoleGroupWithContext(otherContext, accounts[1], ROLEGROUPS.SYSTEM_MANAGERS).should.eventually.eq(false)
  })
})
import { EvmSnapshot } from './utils'
import { getAccounts } from '../deploy/utils'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ROLES, ROLEGROUPS } from '../utils/constants'

const AccessControl = artifacts.require("./base/AccessControl")

describe('AccessControl', () => {
  const evmSnapshot = new EvmSnapshot()
  let accounts

  let acl
  let settings
  let accessControl
  let accessControlContext
  let otherContext

  before(async () => {
    accounts = await getAccounts()
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    accessControl = await AccessControl.new(settings.address)
    accessControlContext = await accessControl.aclContext()
    otherContext = await acl.generateContextFromAddress(accounts[5])
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('inRoleGroup', async () => {
    await accessControl.inRoleGroup(accounts[0], ROLEGROUPS.SYSTEM_ADMINS).should.eventually.eq(true)
    await accessControl.inRoleGroup(accounts[0], ROLEGROUPS.SYSTEM_MANAGERS).should.eventually.eq(true)
  })

  it('inRoleGroupWithContext', async () => {
    await acl.assignRole(accessControlContext, accounts[1], ROLES.SYSTEM_MANAGER)
    await accessControl.inRoleGroupWithContext(accessControlContext, accounts[1], ROLEGROUPS.SYSTEM_MANAGERS).should.eventually.eq(true)
    await accessControl.inRoleGroupWithContext(otherContext, accounts[1], ROLEGROUPS.SYSTEM_MANAGERS).should.eventually.eq(false)
  })
})
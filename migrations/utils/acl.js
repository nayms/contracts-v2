const { deploy } = require('./functions')
const { createLog } = require('./log')

const { ROLES, ROLEGROUPS } = require('./constants')

export const ensureAclIsDeployed = async ({ deployer, artifacts, logger }) => {
  const log = createLog(logger)

  log('Deploying ACL ...')
  const ACL = artifacts.require("./ACL")
  const acl = await deploy(deployer, ACL, ROLES.SYSTEM_ADMIN, ROLEGROUPS.SYSTEM_ADMINS)
  log(`... deployed at ${acl.address}`)

  log('Ensure ACL role groups and roles are setup ...')

  // setup role groups
  await acl.setRoleGroup(ROLEGROUPS.ASSET_MANAGERS, [ ROLES.ASSET_MANAGER ])
  await acl.setRoleGroup(ROLEGROUPS.CLIENT_MANAGERS, [ ROLES.CLIENT_MANAGER ])
  await acl.setRoleGroup(ROLEGROUPS.ENTITY_ADMINS, [ ROLES.ENTITY_ADMIN, ROLES.SOLE_PROP, ROLES.NAYM ])
  await acl.setRoleGroup(ROLEGROUPS.ENTITY_MANAGERS, [ ROLES.ENTITY_MANAGER ])
  await acl.setRoleGroup(ROLEGROUPS.FUND_MANAGERS, [ ROLES.SOLE_PROP, ROLES.ENTITY_ADMIN, ROLES.NAYM ])
  await acl.setRoleGroup(ROLEGROUPS.POLICY_APPROVERS, [ ROLES.ASSET_MANAGER, ROLES.BROKER, ROLES.CLIENT_MANAGER, ROLES.SOLE_PROP ])
  await acl.setRoleGroup(ROLEGROUPS.POLICY_CREATORS, [ ROLES.ENTITY_MANAGER ])
  await acl.setRoleGroup(ROLEGROUPS.POLICY_MANAGERS, [ ROLES.POLICY_MANAGER, ROLES.ENTITY_REP, ROLES.SOLE_PROP ])
  await acl.setRoleGroup(ROLEGROUPS.POLICY_OWNERS, [ROLES.POLICY_OWNER])
  await acl.setRoleGroup(ROLEGROUPS.SYSTEM_ADMINS, [ROLES.SYSTEM_ADMIN])
  await acl.setRoleGroup(ROLEGROUPS.SYSTEM_MANAGERS, [ROLES.SYSTEM_MANAGER])
  await acl.setRoleGroup(ROLEGROUPS.TRADERS, [ROLES.NAYM, ROLES.ENTITY_REP, ROLES.SOLE_PROP])

  // setup assigners
  await acl.addAssigner(ROLES.ASSET_MANAGER, ROLEGROUPS.POLICY_OWNERS)
  await acl.addAssigner(ROLES.BROKER, ROLEGROUPS.POLICY_OWNERS)
  await acl.addAssigner(ROLES.CLIENT_MANAGER, ROLEGROUPS.POLICY_OWNERS)
  await acl.addAssigner(ROLES.ENTITY_ADMIN, ROLEGROUPS.SYSTEM_MANAGERS)
  await acl.addAssigner(ROLES.ENTITY_MANAGER, ROLEGROUPS.ENTITY_ADMINS)
  await acl.addAssigner(ROLES.ENTITY_REP, ROLEGROUPS.ENTITY_MANAGERS)
  await acl.addAssigner(ROLES.NAYM, ROLEGROUPS.SYSTEM_MANAGERS)
  await acl.addAssigner(ROLES.SOLE_PROP, ROLEGROUPS.SYSTEM_MANAGERS)
  await acl.addAssigner(ROLES.SYSTEM_MANAGER, ROLEGROUPS.SYSTEM_ADMINS)

  log('... role groups and roles have been setup.')

  return acl
}


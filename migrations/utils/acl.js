const { sha3, deploy } = require('./functions')
const { createLog } = require('./log')

const { ROLES, ROLEGROUPS } = require('./constants')

export const ensureAclIsDeployed = async ({ deployer, artifacts, logger }) => {
  const log = createLog(logger)

  log('Deploying ACL ...')
  const ACL = artifacts.require("./ACL")
  const acl = await deploy(deployer, ACL)
  log(`... deployed at ${acl.address}`)

  log('Ensure ACL role groups and roles are setup ...')

  // setup role groups
  await acl.setRoleGroup(ROLEGROUPS.MANAGE_ENTITY, [ ROLES.ENTITY_ADMIN, ROLES.ENTITY_MANAGER ])
  await acl.setRoleGroup(ROLEGROUPS.MANAGE_POLICY, [ ROLES.ENTITY_MANAGER, ROLES.ENTITY_REPRESENTATIVE ])
  await acl.setRoleGroup(ROLEGROUPS.APPROVE_POLICY, [ ROLES.ASSET_MANAGER, ROLES.CLIENT_MANAGER ])

  // setup assigners
  await acl.addAssigner(ROLES.ENTITY_MANAGER, ROLES.ENTITY_ADMIN)
  await acl.addAssigner(ROLES.ENTITY_REPRESENTATIVE, ROLES.ENTITY_MANAGER)
  await acl.addAssigner(ROLES.ASSET_MANAGER, ROLES.ENTITY_REPRESENTATIVE)
  await acl.addAssigner(ROLES.CLIENT_MANAGER, ROLES.ENTITY_REPRESENTATIVE)

  log('... role groups and roles have been setup.')

  return acl
}


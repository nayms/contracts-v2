const { sha3, deploy } = require('./functions')
const { createLog } = require('./log')

export const ROLE_ENTITY_ADMIN = sha3('roleEntityAdmin')
export const ROLE_ENTITY_MANAGER = sha3('roleEntityManager')
export const ROLE_ENTITY_REPRESENTATIVE = sha3('roleEntityRepresentative')
export const ROLE_ASSET_MANAGER = sha3('roleAssetManager')
export const ROLE_CLIENT_MANAGER = sha3('roleClientManager')

export const ROLEGROUP_MANAGE_ENTITY = sha3('rolegroupManageEntity')
export const ROLEGROUP_MANAGE_POLICY = sha3('rolegroupManagePolicy')
export const ROLEGROUP_APPROVE_POLICY = sha3('rolegroupApprovePolicy')

export const ensureAclIsDeployed = async ({ deployer, artifacts, logger }) => {
  const log = createLog(logger)

  log('Deploying ACL ...')
  const ACL = artifacts.require("./ACL")
  const acl = await deploy(deployer, ACL)
  log(`... deployed at ${acl.address}`)

  log('Ensure ACL role groups and roles are setup ...')

  // setup role groups
  await acl.setRoleGroup(ROLEGROUP_MANAGE_ENTITY, [ ROLE_ENTITY_ADMIN, ROLE_ENTITY_MANAGER ])
  await acl.setRoleGroup(ROLEGROUP_MANAGE_POLICY, [ ROLE_ENTITY_MANAGER, ROLE_ENTITY_REPRESENTATIVE ])
  await acl.setRoleGroup(ROLEGROUP_APPROVE_POLICY, [ ROLE_ASSET_MANAGER, ROLE_CLIENT_MANAGER ])

  // setup assigners
  await acl.addAssigner(ROLE_ENTITY_MANAGER, ROLE_ENTITY_ADMIN)
  await acl.addAssigner(ROLE_ENTITY_REPRESENTATIVE, ROLE_ENTITY_MANAGER)
  await acl.addAssigner(ROLE_ASSET_MANAGER, ROLE_ENTITY_REPRESENTATIVE)
  await acl.addAssigner(ROLE_CLIENT_MANAGER, ROLE_ENTITY_REPRESENTATIVE)

  log('... role groups and roles have been setup.')

  return acl
}


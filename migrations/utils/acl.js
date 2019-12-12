const { sha3 } = require('./functions')

export const ROLE_ENTITY_ADMIN = sha3('roleEntityAdmin')
export const ROLE_ENTITY_MANAGER = sha3('roleEntityManager')
export const ROLE_ENTITY_REPRESENTATIVE = sha3('roleEntityRepresentative')
export const ROLE_ASSET_MANAGER = sha3('roleAssetManager')
export const ROLE_CLIENT_MANAGER = sha3('roleClientManager')

export const ROLEGROUP_MANAGE_ENTITY = sha3('rolegroupManageEntity')
export const ROLEGROUP_MANAGE_POLICY = sha3('rolegroupManagePolicy')
export const ROLEGROUP_APPROVE_POLICY = sha3('rolegroupApprovePolicy')

export const deployAcl = async ({ deployer, artifacts }) => {
  const ACL = artifacts.require("./base/ACL")

  let acl
  if (deployer) {
    await deployer.deploy(ACL)
    acl = await ACL.deployed()
  } else {
    acl = await ACL.new()
  }

  // setup role groups
  await acl.setRoleGroup(ROLEGROUP_MANAGE_ENTITY, [ ROLE_ENTITY_ADMIN, ROLE_ENTITY_MANAGER ])
  await acl.setRoleGroup(ROLEGROUP_MANAGE_POLICY, [ ROLE_ENTITY_MANAGER, ROLE_ENTITY_REPRESENTATIVE ])
  await acl.setRoleGroup(ROLEGROUP_APPROVE_POLICY, [ ROLE_ASSET_MANAGER, ROLE_CLIENT_MANAGER ])

  // setup assigners
  await acl.addAssigner(ROLE_ENTITY_MANAGER, ROLE_ENTITY_ADMIN)
  await acl.addAssigner(ROLE_ENTITY_REPRESENTATIVE, ROLE_ENTITY_MANAGER)
  await acl.addAssigner(ROLE_ASSET_MANAGER, ROLE_ENTITY_REPRESENTATIVE)
  await acl.addAssigner(ROLE_CLIENT_MANAGER, ROLE_ENTITY_REPRESENTATIVE)

  return acl
}


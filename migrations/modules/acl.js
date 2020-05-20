const _ = require('lodash')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../../utils/functions')
const { createLog } = require('../../utils/log')

const { ROLES, ROLEGROUPS } = require('../../utils/constants')

export const getCurrentAcl = async ({ artifacts, networkId, log }) => {
  return getCurrentInstance({ networkId, log, artifacts, type: 'IACL', lookupType: 'ACL' })
}

export const ensureAclIsDeployed = async ({ deployer, artifacts, log, getTxParams = defaultGetTxParams }) => {
  log = createLog(log)

  let acl

  await log.task('Deploy ACL', async task => {
    const ACL = artifacts.require("./ACL")
    acl = await deploy(deployer, getTxParams(), ACL, ROLES.SYSTEM_ADMIN, ROLEGROUPS.SYSTEM_ADMINS)
    task.log(`Deployed at ${acl.address}`)
  })

  await log.task(`Ensure ACL role groups are setup`, async () => {
    await Promise.all([
      acl.setRoleGroup(ROLEGROUPS.ASSET_MANAGERS, [ROLES.ASSET_MANAGER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.BROKERS, [ROLES.BROKER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.CLIENT_MANAGERS, [ROLES.CLIENT_MANAGER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.ENTITY_ADMINS, [ROLES.ENTITY_ADMIN, ROLES.SOLE_PROP, ROLES.NAYM], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.ENTITY_MANAGERS, [ROLES.ENTITY_MANAGER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.ENTITY_REPS, [ROLES.ENTITY_REP], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.FUND_MANAGERS, [ROLES.SOLE_PROP, ROLES.ENTITY_ADMIN, ROLES.NAYM], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.POLICY_APPROVERS, [ROLES.ASSET_MANAGER, ROLES.BROKER, ROLES.CLIENT_MANAGER, ROLES.SOLE_PROP], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.POLICY_CREATORS, [ROLES.ENTITY_MANAGER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.POLICY_OWNERS, [ROLES.POLICY_OWNER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.SYSTEM_ADMINS, [ROLES.SYSTEM_ADMIN], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.SYSTEM_MANAGERS, [ROLES.SYSTEM_MANAGER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.TRADERS, [ROLES.NAYM, ROLES.ENTITY_REP, ROLES.SOLE_PROP], getTxParams()),
    ])
  })

  await log.task(`Ensure ACL role assigners are setup`, async () => {
    await Promise.all([
      acl.addAssigner(ROLES.ASSET_MANAGER, ROLEGROUPS.POLICY_OWNERS, getTxParams()),
      acl.addAssigner(ROLES.BROKER, ROLEGROUPS.POLICY_OWNERS, getTxParams()),
      acl.addAssigner(ROLES.CLIENT_MANAGER, ROLEGROUPS.POLICY_OWNERS, getTxParams()),
      acl.addAssigner(ROLES.ENTITY_ADMIN, ROLEGROUPS.SYSTEM_MANAGERS, getTxParams()),
      acl.addAssigner(ROLES.ENTITY_MANAGER, ROLEGROUPS.ENTITY_ADMINS, getTxParams()),
      acl.addAssigner(ROLES.ENTITY_REP, ROLEGROUPS.ENTITY_MANAGERS, getTxParams()),
      acl.addAssigner(ROLES.NAYM, ROLEGROUPS.SYSTEM_MANAGERS, getTxParams()),
      acl.addAssigner(ROLES.SOLE_PROP, ROLEGROUPS.SYSTEM_MANAGERS, getTxParams()),
      acl.addAssigner(ROLES.SYSTEM_MANAGER, ROLEGROUPS.SYSTEM_ADMINS, getTxParams()),
    ])
  })

  return acl
}


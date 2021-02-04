const _ = require('lodash')
const { deploy, getCurrentInstance, defaultGetTxParams } = require('../utils')
const { createLog } = require('../utils/log')

const { ROLES, ROLEGROUPS } = require('../../utils/constants')

export const getCurrentAcl = async ({ artifacts, networkInfo, log }) => {
  return getCurrentInstance({ networkInfo, log, artifacts, type: 'IACL', lookupType: 'ACL' })
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
      acl.setRoleGroup(ROLEGROUPS.CAPITAL_PROVIDERS, [ROLES.UNDERWRITER, ROLES.CAPITAL_PROVIDER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.UNDERWRITERS, [ROLES.UNDERWRITER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.BROKERS, [ROLES.BROKER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.INSURED_PARTYS, [ROLES.INSURED_PARTY], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.ENTITY_ADMINS, [ROLES.ENTITY_ADMIN], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.ENTITY_MANAGERS, [ROLES.ENTITY_ADMIN, ROLES.ENTITY_MANAGER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.ENTITY_REPS, [ROLES.ENTITY_ADMIN, ROLES.ENTITY_MANAGER, ROLES.ENTITY_REP], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.POLICY_OWNERS, [ROLES.POLICY_OWNER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.SYSTEM_ADMINS, [ROLES.SYSTEM_ADMIN], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.SYSTEM_MANAGERS, [ROLES.SYSTEM_MANAGER], getTxParams()),
      acl.setRoleGroup(ROLEGROUPS.TRADERS, [ROLES.ENTITY_REP], getTxParams()),
    ])
  })

  await log.task(`Ensure ACL role assigners are setup`, async () => {
    await Promise.all([
      acl.addAssigner(ROLES.UNDERWRITER, ROLEGROUPS.POLICY_OWNERS, getTxParams()),
      acl.addAssigner(ROLES.CAPITAL_PROVIDER, ROLEGROUPS.POLICY_OWNERS, getTxParams()),
      acl.addAssigner(ROLES.BROKER, ROLEGROUPS.POLICY_OWNERS, getTxParams()),
      acl.addAssigner(ROLES.INSURED_PARTY, ROLEGROUPS.POLICY_OWNERS, getTxParams()),
      acl.addAssigner(ROLES.ENTITY_ADMIN, ROLEGROUPS.SYSTEM_ADMINS, getTxParams()),
      acl.addAssigner(ROLES.ENTITY_MANAGER, ROLEGROUPS.ENTITY_ADMINS, getTxParams()),
      acl.addAssigner(ROLES.ENTITY_REP, ROLEGROUPS.ENTITY_MANAGERS, getTxParams()),
      acl.addAssigner(ROLES.SYSTEM_MANAGER, ROLEGROUPS.SYSTEM_ADMINS, getTxParams()),
    ])
  })

  return acl
}


export const setAclAdminToMultisigAddress = async ({ accounts, log, getTxParams = defaultGetTxParams, acl }, multisig) => {
  log = createLog(log)

  if (acl && multisig) { 
    await log.task('Set Multisig as ACL admin', async task => {
      await acl.addAdmin(multisig, getTxParams())
      await acl.removeAdmin(accounts[0], getTxParams())
    })
  }
}
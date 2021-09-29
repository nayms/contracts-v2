import _ from 'lodash'
import { getDeployedContractInstance, deployContract, getContractAt, getMethodExecutor, execMethod, createLog } from '../utils'

import { ROLES, ROLEGROUPS } from '../../utils/constants'

const ROLE_MAPPINGS = {
  [ROLEGROUPS.APPROVED_USERS]: [ROLES.APPROVED_USER],
  [ROLEGROUPS.CAPITAL_PROVIDERS]: [ROLES.UNDERWRITER, ROLES.CAPITAL_PROVIDER],
  [ROLEGROUPS.UNDERWRITERS]: [ROLES.UNDERWRITER],
  [ROLEGROUPS.BROKERS]: [ROLES.BROKER],
  [ROLEGROUPS.INSURED_PARTYS]: [ROLES.INSURED_PARTY],
  [ROLEGROUPS.CLAIMS_ADMINS]: [ROLES.CLAIMS_ADMIN],
  [ROLEGROUPS.ENTITY_ADMINS]: [ROLES.ENTITY_ADMIN],
  [ROLEGROUPS.ENTITY_MANAGERS]: [ROLES.ENTITY_ADMIN, ROLES.ENTITY_MANAGER],
  [ROLEGROUPS.ENTITY_REPS]: [ROLES.ENTITY_ADMIN, ROLES.ENTITY_MANAGER, ROLES.ENTITY_REP],
  [ROLEGROUPS.POLICY_OWNERS]: [ROLES.POLICY_OWNER],
  [ROLEGROUPS.SYSTEM_ADMINS]: [ROLES.SYSTEM_ADMIN],
  [ROLEGROUPS.SYSTEM_MANAGERS]: [ROLES.SYSTEM_MANAGER],
  [ROLEGROUPS.TRADERS]: [ROLES.ENTITY_REP],
}

const ASSIGNER_MAPPINGS = [
  [ROLES.APPROVED_USER, ROLEGROUPS.SYSTEM_MANAGERS],
  [ROLES.UNDERWRITER, ROLEGROUPS.POLICY_OWNERS],
  [ROLES.CAPITAL_PROVIDER, ROLEGROUPS.POLICY_OWNERS],
  [ROLES.BROKER, ROLEGROUPS.POLICY_OWNERS],
  [ROLES.INSURED_PARTY, ROLEGROUPS.POLICY_OWNERS],
  [ROLES.ENTITY_ADMIN, ROLEGROUPS.SYSTEM_ADMINS],
  [ROLES.ENTITY_MANAGER, ROLEGROUPS.ENTITY_ADMINS],
  [ROLES.ENTITY_REP, ROLEGROUPS.ENTITY_MANAGERS],
  [ROLES.ENTITY_REP, ROLEGROUPS.SYSTEM_MANAGERS],
  [ROLES.SYSTEM_MANAGER, ROLEGROUPS.SYSTEM_ADMINS],
]

export const getCurrentAcl = async ({ network, log }) => {
  return getDeployedContractInstance({ network, log, type: 'IACL', lookupType: 'ACL' })
}

export const ensureAclIsDeployed = async (ctx = {}) => {
  const log = createLog(ctx.log)

  let acl

  await log.task('Deploy ACL', async task => {
    acl = await deployContract(ctx, 'ACL', [ROLES.SYSTEM_ADMIN, ROLEGROUPS.SYSTEM_ADMINS])
    task.log(`Deployed at ${acl.address}`)
  })

  await log.task('Setup ACL', async task => {
    const exec = getMethodExecutor({ ctx, task, contract: acl })

    await task.task(`Ensure ACL role groups are setup`, async () => {
      await Promise.all(
        Object.entries(ROLE_MAPPINGS).map(([group, roles]) => (
          exec('setRoleGroup', group, roles)
        ))
      )
    })

    await task.task(`Ensure ACL role assigners are setup`, async () => {
      await Promise.all(
        ASSIGNER_MAPPINGS.map(args => (
          exec('addAssigner', ...args)
        ))
      )
    })
  })

  return await getContractAt(ctx, 'ACL', acl.address)
}


export const addMultisigAddressAsSystemAdmin = async (ctx, { multisig, replaceExisting = false }) => {
  const { accounts, log: baseLog, acl } = ctx

  const log = createLog(baseLog)

  if (acl && multisig) { 
    await log.task('Add Multisig as ACL admin', async task => {
      const exec = getMethodExecutor({ ctx, task, contract: acl })
      
      await exec('addAdmin', multisig)

      if (replaceExisting) {
        await task.log('Removing existing ACL admin...')

        await exec('removeAdmin', accounts[0])
      }
    })

    await log.task('Check ACL admin assignments', async task => {
      const check = await Promise.all([
        acl.isAdmin(multisig),
        acl.isAdmin(accounts[0])
      ])

      await task.log(`isAdmin(multisig - ${multisig}): ${check[0]}`)
      await task.log(`isAdmin(account0 - ${accounts[0]}): ${check[1]}`)
    })
  }
}
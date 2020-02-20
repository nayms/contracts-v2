const { sha3 } = require('./functions')

exports.ROLES = {}
exports.ROLEGROUPS = {}

;[
  'ASSET_MANAGER',
  'BROKER',
  'CLIENT_MANAGER',
  'ENTITY_ADMIN',
  'ENTITY_MANAGER',
  'ENTITY_REP',
  'NAYM',
  'POLICY_MANAGER',
  'POLICY_OWNER',
  'SOLE_PROP',
  'SYSTEM_ADMIN',
  'SYSTEM_MANAGER',
].forEach(r => {
  exports.ROLES[r] = sha3(`role_${r}`)
})

;[
  'ASSET_MANAGERS',
  'CLIENT_MANAGERS',
  'ENTITY_ADMINS',
  'ENTITY_MANAGERS',
  'FUND_MANAGERS',
  'POLICY_APPROVERS',
  'POLICY_CREATORS',
  'POLICY_MANAGERS',
  'POLICY_OWNERS',
  'SYSTEM_ADMINS',
  'SYSTEM_MANAGERS',
  'TRADERS',
].forEach(r => {
  exports.ROLEGROUPS[r] = sha3(`role_${r}`)
})

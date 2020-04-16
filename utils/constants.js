const { keccak256 } = require('./functions')

exports.ROLES = {}
exports.ROLEGROUPS = {}
exports.SETTINGS = {}

;[
  'ASSET_MANAGER',
  'BROKER',
  'CLIENT_MANAGER',
  'ENTITY_ADMIN',
  'ENTITY_MANAGER',
  'ENTITY_REP',
  'NAYM',
  'POLICY_OWNER',
  'SOLE_PROP',
  'SYSTEM_ADMIN',
  'SYSTEM_MANAGER',
].forEach(r => {
  exports.ROLES[r] = keccak256(`role_${r}`)
})

;[
  'ASSET_MANAGERS',
  'BROKERS',
  'CLIENT_MANAGERS',
  'ENTITY_ADMINS',
  'ENTITY_MANAGERS',
  'ENTITY_REPS',
  'FUND_MANAGERS',
  'POLICY_APPROVERS',
  'POLICY_CREATORS',
  'POLICY_OWNERS',
  'SYSTEM_ADMINS',
  'SYSTEM_MANAGERS',
  'TRADERS',
].forEach(r => {
  exports.ROLEGROUPS[r] = keccak256(`role_${r}`)
})


;[
  'MARKET',
  'POLICY_IMPL',
  'POLICY_MUTATIONS_IMPL',
  'ENTITY_DEPLOYER',
  'NAYMS_ENTITY',
].forEach(r => {
  exports.SETTINGS[r] = keccak256(`setting_${r}`)
})



const { keccak256 } = require('./functions')

exports.ROLES = {}
exports.ROLEGROUPS = {}
exports.SETTINGS = {}

;[
  'CAPITAL_PROVIDER',
  'BROKER',
  'INSURED_PARTY',
  'ENTITY_ADMIN',
  'ENTITY_MANAGER',
  'ENTITY_REP',
  'NAYM',
  'POLICY_OWNER',
  'SOLE_PROP',
  'SYSTEM_ADMIN',
  'SYSTEM_MANAGER',
].forEach(r => {
  exports.ROLES[r] = keccak256(`ROLE_${r}`)
})

;[
  'CAPITAL_PROVIDERS',
  'BROKERS',
  'INSURED_PARTYS',
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
  exports.ROLEGROUPS[r] = keccak256(`ROLEGROUP_${r}`)
})


;[
  'MARKET',
  'ETHER_TOKEN',
  'ENTITY_IMPL',
  'POLICY_IMPL',
  'ENTITY_DEPLOYER',
  'NAYMS_ENTITY',
].forEach(r => {
  exports.SETTINGS[r] = keccak256(`SETTING_${r}`)
})


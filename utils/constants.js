const { keccak256 } = require('./functions')

exports.ROLES = {}
exports.ROLEGROUPS = {}
exports.SETTINGS = {}

;[
  'PENDING_CAPITAL_PROVIDER',
  'PENDING_BROKER',
  'PENDING_INSURED_PARTY',
  'PENDING_CLAIMS_ADMIN',
  'CAPITAL_PROVIDER',
  'BROKER',
  'INSURED_PARTY',
  'CLAIMS_ADMIN',
  'ENTITY_ADMIN',
  'ENTITY_MANAGER',
  'ENTITY_REP',
  'POLICY_OWNER',
  'SYSTEM_ADMIN',
  'SYSTEM_MANAGER',
  'UNDERWRITER',
].forEach(r => {
  exports.ROLES[r] = keccak256(`ROLE_${r}`)
})

;[
  'CAPITAL_PROVIDERS',
  'BROKERS',
  'INSURED_PARTYS',
  'CLAIMS_ADMINS',
  'ENTITY_ADMINS',
  'ENTITY_MANAGERS',
  'ENTITY_REPS',
  'POLICY_OWNERS',
  'SYSTEM_ADMINS',
  'SYSTEM_MANAGERS',
  'TRADERS',
  'UNDERWRITERS',
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


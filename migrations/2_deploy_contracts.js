const { ensureAclIsDeployed } = require('./modules/acl')
const { ensureMarketIsDeployed } = require('./modules/market')
const { ensureSettingsIsDeployed } = require('./modules/settings')
const { ensureEtherTokenIsDeployed } = require('./modules/etherToken')
const { ensureEntityDeployerIsDeployed } = require('./modules/entityDeployer')
const { ensureEntityImplementationsAreDeployed } = require('./modules/entityImplementations')
const { ensurePolicyImplementationsAreDeployed } = require('./modules/policyImplementations')

module.exports = async deployer => {
  const acl = await ensureAclIsDeployed({ deployer, artifacts, logger: true })
  const settings = await ensureSettingsIsDeployed({ deployer, artifacts, logger: true }, acl.address)

  await ensureMarketIsDeployed({ deployer, artifacts, logger: true }, settings.address)
  await ensureEtherTokenIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await ensureEntityImplementationsAreDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await ensureEntityDeployerIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await ensurePolicyImplementationsAreDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
}

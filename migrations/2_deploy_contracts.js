const EntityImpl = artifacts.require("./EntityImpl")

const { ensureAclIsDeployed } = require('./modules/acl')
const { ensureMarketIsDeployed } = require('./modules/market')
const { ensureSettingsIsDeployed } = require('./modules/settings')
const { ensureEtherTokenIsDeployed } = require('./modules/etherToken')
const { ensureEntityDeployerIsDeployed } = require('./modules/entityDeployer')
const { ensurePolicyImplementationsAreDeployed } = require('./modules/policyImplementations')

module.exports = async deployer => {
  const acl = await ensureAclIsDeployed({ deployer, artifacts, logger: true })
  const settings = await ensureSettingsIsDeployed({ deployer, artifacts, logger: true }, acl.address)

  await ensureEtherTokenIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
  await ensureMarketIsDeployed({ deployer, artifacts, logger: true }, settings.address)

  const entityImpl = await deployer.deploy(EntityImpl, acl.address, settings.address)

  await ensureEntityDeployerIsDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address, entityImpl.address)
  await ensurePolicyImplementationsAreDeployed({ deployer, artifacts, logger: true }, acl.address, settings.address)
}

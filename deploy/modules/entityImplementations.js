import { deployUpgradeableContract } from './lib'
import { SETTINGS } from '../../utils/constants'

export const ensureEntityImplementationsAreDeployed = async (ctx = {}) => {
  const { extraFacets = [] } = ctx

  return await deployUpgradeableContract({
    ctx,
    friendlyName: 'Entity delegate',
    proxyContractName: 'EntityDelegate',
    proxyInterfaceName: 'IEntity',
    facetContractNames: [
      'EntityCoreFacet',
      'EntityTokensFacet',
      'EntityDividendsFacet',
      'EntityTreasuryFacet',
      'EntityTreasuryBridgeFacet',
    ].concat(extraFacets),
    facetListSettingsKey: SETTINGS.ENTITY_IMPL,
    proxySettingsKey: SETTINGS.ENTITY_DELEGATE,
  })
}

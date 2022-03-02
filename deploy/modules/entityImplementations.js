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
      'EntityFundingFacet',
      'EntityTokensFacet',
      'EntityDividendsFacet',
      'EntityTreasuryFacet',
      'EntityTreasuryBridgeFacet',
      'EntitySimplePolicyCoreFacet',
      'EntitySimplePolicyDataFacet',
    ].concat(extraFacets),
    facetListSettingsKey: SETTINGS.ENTITY_IMPL,
    proxySettingsKey: SETTINGS.ENTITY_DELEGATE,
  })
}

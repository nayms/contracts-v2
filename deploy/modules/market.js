import { deployUpgradeableContract } from './lib'
import { SETTINGS } from '../../utils/constants'

export const ensureMarketIsDeployed = async (ctx) => {
  const { extraFacets = [] } = ctx

  return await deployUpgradeableContract({
    ctx,
    friendlyName: 'Market',
    proxyContractName: 'Market',
    proxyInterfaceName: 'IMarket',
    facetContractNames: ['MarketCoreFacet', 'MarketDataFacet'].concat(extraFacets),
    facetListSettingsKey: SETTINGS.MARKET_IMPL,
    proxySettingsKey: SETTINGS.MARKET,
  })
}


import { deployUpgradeableContract } from './lib'
import { SETTINGS } from '../../utils/constants'

export const ensureFeeBankIsDeployed = async (ctx) => {
  const { extraFacets = [] } = ctx

  return await deployUpgradeableContract({
    ctx,
    friendlyName: 'Fee bank',
    proxyContractName: 'FeeBank',
    proxyInterfaceName: 'IFeeBank',
    facetContractNames: ['FeeBankCoreFacet'].concat(extraFacets),
    facetListSettingsKey: SETTINGS.FEEBANK_IMPL,
    proxySettingsKey: SETTINGS.FEEBANK,
  })
}

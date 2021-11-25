import { deployUpgradeableContract } from './lib'
import { SETTINGS } from '../../utils/constants'

export const ensurePolicyImplementationsAreDeployed = async (ctx = {}) => {
  const { extraFacets = [] } = ctx

  return await deployUpgradeableContract({
    ctx,
    friendlyName: 'Policy delegate',
    proxyContractName: 'PolicyDelegate',
    proxyInterfaceName: 'IPolicy',
    facetContractNames: [
      'PolicyCoreFacet',
      'PolicyClaimsFacet',
      'PolicyCommissionsFacet',
      'PolicyPremiumsFacet',
      'PolicyTrancheTokensFacet',
      'PolicyApprovalsFacet',
    ].concat(extraFacets),
    facetListSettingsKey: SETTINGS.POLICY_IMPL,
    proxySettingsKey: SETTINGS.POLICY_DELEGATE,
  })
}
import { ETHER_TOKEN_ADDRESSES } from '../../constants'

export const ensureEtherTokenIsDeployed = async ({ artifacts, accounts, web3 }) => {
  const networkId = await web3.eth.net.getId()

  const found = ETHER_TOKEN_ADDRESSES[`${networkId}`]

  if (found) {
    return found
  }

  const EtherToken = artifacts.require('./base/EtherToken')

  return (await EtherToken.new())
}

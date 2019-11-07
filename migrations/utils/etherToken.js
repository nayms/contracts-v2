export const ensureEtherTokenIsDeployed = async ({ artifacts, accounts, web3 }) => {
  const networkId = await web3.eth.net.getId()

  // addresses from: https://blog.0xproject.com/canonical-weth-a9aa7d0279dd
  switch (`${networkId}`) {
    case '1': // mainnet
      return '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    case '3': // ropsten
    case '4': // rinkeby
      return '0xc778417e063141139fce010982780140aa0cd5ab'
    case '42': // kovan
      return '0xd0a1e359811322d97991e03f863a0c30c2cf029c'
    default:
      // pass through to below
  }

  const EtherToken = artifacts.require('./base/EtherToken')

  return (await EtherToken.new()).address
}

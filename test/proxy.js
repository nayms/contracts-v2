import { toHex, toWei, sha3 } from 'web3-utils'

import { ensureErc1820RegistryIsDeployed } from '../migrations/utils'
import { ADDRESS_ZERO, hdWallet } from './utils'
import { events } from '../'

const TestProxy = artifacts.require("./test/TestProxy.sol")
const TestProxyImpl = artifacts.require("./test/TestProxyImpl.sol")
const ITestProxyImpl = artifacts.require("./test/ITestProxyImpl.sol")

contract('Proxy (base class)', accounts => {
  let testProxy
  let testProxyImpl
  let proxy

  beforeEach(async () => {
    testProxyImpl = await TestProxyImpl.new()
    testProxy = await TestProxy.new(testProxyImpl.address)
    proxy = await ITestProxyImpl.at(testProxy.address)
  })

  it('cannot delegate to null implementation', async () => {
    await testProxy.unsafeUpgrade(ADDRESS_ZERO).should.be.fulfilled
    await proxy.incCounter().should.be.rejectedWith('implementation not set')
  })

  it('cannot upgrade to null implementation', async () => {
    await testProxy.upgrade(ADDRESS_ZERO).should.be.rejectedWith('implementation must be valid')
  })

  it('cannot get signer for null implementation', async () => {
    const sig = hdWallet.sign({ address: accounts[0], data: sha3('test') })
    await testProxy.getSigner(ADDRESS_ZERO, sig).should.be.rejectedWith('implementation must be valid')
  })

  it('cannot get signer if signer is empty', async () => {
    await testProxy.getSigner(testProxyImpl.address, "0x0").should.be.rejectedWith('valid signer not found')
  })
})

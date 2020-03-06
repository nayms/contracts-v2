import { keccak256 } from './utils/web3'
import { ADDRESS_ZERO, hdWallet } from './utils'

const TestProxy = artifacts.require("./test/TestProxy")
const TestProxyImpl = artifacts.require("./test/TestProxyImpl")
const ITestProxyImpl = artifacts.require("./test/ITestProxyImpl")

contract('Proxy base class', accounts => {
  let testProxy
  let testProxyImpl
  let int

  beforeEach(async () => {
    testProxyImpl = await TestProxyImpl.new()
    testProxy = await TestProxy.new(testProxyImpl.address)
    int = await ITestProxyImpl.at(testProxy.address)
  })

  it('cannot delegate to null implementation', async () => {
    await testProxy.unsafeUpgrade(ADDRESS_ZERO).should.be.fulfilled
    await int.incCounter().should.be.rejectedWith('implementation not set')
  })

  it('cannot upgrade to null implementation', async () => {
    await testProxy.upgrade(ADDRESS_ZERO).should.be.rejectedWith('implementation must be valid')
  })

  it('cannot get signer for null implementation', async () => {
    const sig = hdWallet.sign({ address: accounts[0], data: keccak256('test') })
    await testProxy.getSigner(ADDRESS_ZERO, sig).should.be.rejectedWith('implementation must be valid')
  })

  it('cannot get signer if signer is empty', async () => {
    await testProxy.getSigner(testProxyImpl.address, "0x0").should.be.rejectedWith('valid signer not found')
  })

  it('can delegate if all else is ok', async () => {
    await int.incCounter().should.be.fulfilled;
    await int.getCounter().should.eventually.eq(1);
  })
})

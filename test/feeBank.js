import EthVal from 'ethval'
import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils'
import { events } from '..'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { deployNewEtherToken } from '../migrations/modules/etherToken'
import { ensureFeeBankIsDeployed } from '../migrations/modules/feeBank'

const IERC20 = artifacts.require("./base/IERC20")

contract('Fee bank', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let settings
  let token1
  let token2
  let feeBank

  before(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    token1 = await deployNewEtherToken({ artifacts, settings })
    token2 = await deployNewEtherToken({ artifacts, settings })
    feeBank = await ensureFeeBankIsDeployed({ artifacts, settings })
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('returns balances', async () => {
    await feeBank.getBalance(token1.address).should.eventually.eq(0)
    await feeBank.getBalance(token2.address).should.eventually.eq(0)

    await token1.deposit({ value: 100 })
    await token1.transfer(feeBank.address, 23)
    
    await feeBank.getBalance(token1.address).should.eventually.eq(23)
    await feeBank.getBalance(token2.address).should.eventually.eq(0)
  })
})
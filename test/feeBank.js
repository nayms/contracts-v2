import { EvmSnapshot } from './utils'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureFeeBankIsDeployed } from '../deploy/modules/feeBank'
import { getAccounts } from '../deploy/utils'

const DummyToken = artifacts.require("./DummyToken")

describe('Fee bank', () => {
  const evmSnapshot = new EvmSnapshot()

  let accounts
  let acl
  let settings
  let token1
  let token2
  let feeBank

  before(async () => {
    accounts = await getAccounts()
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    token1 = await DummyToken.new('Token 1', 'TOK1', 18, 0, false)
    token2 = await DummyToken.new('Token 2', 'TOK2', 18, 0, false)
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
import EthVal from 'ethval'
import { extractEventArgs } from './utils'
import { events } from '../'
import { ensureAclIsDeployed } from '../migrations/utils/acl'
import { ensureEtherTokenIsDeployed } from '../migrations/utils/etherToken'

const getBalance = async a => {
  const bal = await web3.eth.getBalance(a)
  return new EthVal(bal)
}

const eth = v => new EthVal(v, 'eth').toWei().toString(10)

contract('EtherToken', accounts => {
  let acl
  let etherToken

  beforeEach(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address)
  })

  it('has defaults', async () => {
    await etherToken.name().should.eventually.eq('Nayms Wrapped Ether')
    await etherToken.symbol().should.eventually.eq('NAYMS_ETH')
    await etherToken.decimals().should.eventually.eq('18')
    await etherToken.totalSupply().should.eventually.eq('0')
    await web3.eth.getBalance(etherToken.address).should.eventually.eq('0')
  })

  describe('mint and burn', () => {
    it('deposit()', async () => {
      const bal0 = await getBalance(accounts[0])
      const bal1 = await getBalance(accounts[1])

      const ret = await etherToken.deposit({ value: 23 })

      const eventArgs = extractEventArgs(ret, events.Deposit)
      expect(eventArgs).to.include({ sender: accounts[0], value: '23' })

      await etherToken.balanceOf(accounts[0]).should.eventually.eq('23')
      await etherToken.totalSupply().should.eventually.eq('23')
      await web3.eth.getBalance(etherToken.address).should.eventually.eq('23')

      await etherToken.deposit({ from: accounts[1], value: 101 })
      await etherToken.balanceOf(accounts[0]).should.eventually.eq('23')
      await etherToken.balanceOf(accounts[1]).should.eventually.eq('101')
      await etherToken.totalSupply().should.eventually.eq('124')
      await web3.eth.getBalance(etherToken.address).should.eventually.eq('124')

      const newBal0 = await getBalance(accounts[0])
      const newBal1 = await getBalance(accounts[1])

      expect(bal0.sub(newBal0).gt(23)).to.eq(true)
      expect(bal1.sub(newBal1).gt(101)).to.eq(true)
    })

    it('withdraw()', async () => {
      await etherToken.deposit({ value: eth(23) })
      await etherToken.deposit({ from: accounts[1], value: eth(9) })

      const bal0 = await getBalance(accounts[0])
      const bal1 = await getBalance(accounts[1])

      const ret = await etherToken.withdraw(eth(12))

      const eventArgs = extractEventArgs(ret, events.Withdrawal)
      expect(eventArgs).to.include({ receiver: accounts[0], value: eth(12) })

      await etherToken.withdraw(eth(4), { from: accounts[1] })

      await etherToken.totalSupply().should.eventually.eq(eth(16))
      await web3.eth.getBalance(etherToken.address).should.eventually.eq(eth(16))

      const newBal0 = await getBalance(accounts[0])
      const newBal1 = await getBalance(accounts[1])

      expect(bal0.sub(newBal0).lt(eth(23))).to.eq(true)
      expect(bal1.sub(newBal1).lt(eth(9))).to.eq(true)
    })

    it('withdraw() fails if insufficent balance', async () => {
      await etherToken.deposit({ value: 23 })
      await etherToken.withdraw(24).should.be.rejectedWith('EtherToken: insufficient balance')
    })
  })
})

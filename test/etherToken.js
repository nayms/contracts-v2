import EthVal from 'ethval'
import { extractEventArgs, ADDRESS_ZERO } from './utils'
import { events } from '../'
import { ensureAclIsDeployed } from '../migrations/utils/acl'
import { ensureEtherTokenIsDeployed } from '../migrations/utils/etherToken'

const IERC20 = artifacts.require("./base/IERC20")

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

  describe('supports ERC20 operations', () => {
    let tkn
    let tknSupply

    beforeEach(async () => {
      await etherToken.deposit({ value: 1000 })
      tkn = await IERC20.at(etherToken.address)
      tknSupply = await tkn.totalSupply()
    })

    describe('transfer authorization', async () => {
      it('not just anyone can do a transfer', async () => {
        await tkn.transfer(accounts[1], 10).should.be.rejectedWith('EtherToken: msg.sender is unauthorized')
      })

      it('and only admins can authorize transfer operators', async () => {
        await etherToken.setAllowedTransferOperator(accounts[0], true, { from: accounts[1] }).should.be.rejectedWith('must be admin')
        await etherToken.setAllowedTransferOperator(accounts[0], true, { from: accounts[0] }).should.be.fulfilled
      })

      it('people can be authorized to do transfers', async () => {
        await etherToken.setAllowedTransferOperator(accounts[0], true)
        await tkn.transfer(accounts[0], 10).should.be.fulfilled
        await etherToken.setAllowedTransferOperator(accounts[0], false)
        await tkn.transfer(accounts[1], 10).should.be.rejectedWith('EtherToken: msg.sender is unauthorized')
      })

      it('and this applies to transferFrom() too', async () => {
        await etherToken.approve(accounts[1], 200).should.be.fulfilled

        await etherToken.setAllowedTransferOperator(accounts[1], false)

        await tkn.transferFrom(accounts[0], accounts[1], 10, { from: accounts[1] }).should.be.rejectedWith('EtherToken: msg.sender is unauthorized')

        await etherToken.setAllowedTransferOperator(accounts[1], true)

        await tkn.transferFrom(accounts[0], accounts[1], 10, { from: accounts[1] }).should.be.fulfilled
      })
    })

    it('such as approving an address to send on one\'s behalf', async () => {
      const result = await tkn.approve(accounts[1], 2).should.be.fulfilled

      expect(extractEventArgs(result, events.Approval)).to.include({
        owner: accounts[0],
        spender: accounts[1],
        value: '2',
      })

      await tkn.allowance(accounts[0], accounts[1]).should.eventually.eq(2)
    })

    describe('such as transferring one\'s own tokens', () => {
      beforeEach(async () => {
        await etherToken.setAllowedTransferOperator(accounts[0], true, { from: accounts[0] }).should.be.fulfilled
      })

      it('but not when sender does not have enough', async () => {
        await tkn.transfer(accounts[1], tknSupply + 1).should.be.rejectedWith('EtherToken: transfer amount exceeds balance')
      })

      it('but not when recipient is null', async () => {
        await tkn.transfer(ADDRESS_ZERO, tknSupply).should.be.rejectedWith('EtherToken: transfer to the zero address')
      })

      it('the entire balance of a user if need be', async () => {
        await tkn.transfer(accounts[1], tknSupply).should.be.fulfilled

        await tkn.balanceOf(accounts[0]).should.eventually.eq(0)
        await tkn.balanceOf(accounts[1]).should.eventually.eq(tknSupply)
      })

      it('when the sender has enough', async () => {
        const result = await tkn.transfer(accounts[1], 5).should.be.fulfilled

        await tkn.balanceOf(accounts[0]).should.eventually.eq(tknSupply - 5)
        await tkn.balanceOf(accounts[1]).should.eventually.eq(5)

        expect(extractEventArgs(result, events.Transfer)).to.include({
          from: accounts[0],
          to: accounts[1],
          value: '5',
        })
      })
    })

    describe('such as transferring another person\'s tokens', () => {
      beforeEach(async () => {
        await etherToken.setAllowedTransferOperator(accounts[0], true, { from: accounts[0] }).should.be.fulfilled
        await etherToken.setAllowedTransferOperator(accounts[1], true, { from: accounts[0] }).should.be.fulfilled
      })

      it('but not if sender is not approved', async () => {
        await tkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[0] }).should.be.rejectedWith('EtherToken: transfer amount exceeds allowance')
      })

      it('but not when sender is null', async () => {
        await tkn.approve(ADDRESS_ZERO, 5).should.be.rejectedWith('EtherToken: approve to the zero address')
      })

      it('but not if sender exceeds their approved limit', async () => {
        await tkn.approve(accounts[1], 2).should.be.fulfilled
        await tkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[1] }).should.be.rejectedWith('EtherToken: transfer amount exceeds allowance')
      })

      it('if sender meets their approved limit', async () => {
        await tkn.approve(accounts[1], 5).should.be.fulfilled

        const result =
          await tkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[1] }).should.be.fulfilled

        await tkn.balanceOf(accounts[0]).should.eventually.eq(tknSupply - 5)
        await tkn.balanceOf(accounts[2]).should.eventually.eq(5)

        expect(extractEventArgs(result, events.Transfer)).to.include({
          from: accounts[0],
          to: accounts[2],
          value: '5',
        })
      })
    })
  })
})
import { extractEventArgs, ADDRESS_ZERO, getBalance } from './utils'
import { events } from '../'

const IERC20 = artifacts.require("./base/IERC20")
const DummyToken = artifacts.require("./DummyToken")

describe('DummyToken', accounts => {
  let dummyToken

  beforeEach(async () => {
    dummyToken = await DummyToken.new('Dummy token', 'DUM', 18, 0, false)
  })

  it('sets up default values', async () => {
    dummyToken = await DummyToken.new('Dummy token', 'DUM', 8, '100000000', false)

    await dummyToken.name().should.eventually.eq('Dummy token')
    await dummyToken.symbol().should.eventually.eq('DUM')
    await dummyToken.decimals().should.eventually.eq('8')
    await dummyToken.totalSupply().should.eventually.eq('100000000')
    await dummyToken.balanceOf(accounts[0]).should.eventually.eq('100000000')
    await dummyToken.isNaymsPlatformToken().should.eventually.eq(false)
  })

  it('can overwrite platform token boolean', async () => {
    dummyToken = await DummyToken.new('Dummy token', 'DUM', 8, '100000000', true)
    await dummyToken.isNaymsPlatformToken().should.eventually.eq(true)
  })

  describe('mint and burn', () => {
    it('deposit()', async () => {
      const bal0 = await getBalance(accounts[0])
      const bal1 = await getBalance(accounts[1])

      const ret = await dummyToken.deposit({ value: 23 })

      const eventArgs = extractEventArgs(ret, events.Deposit)
      expect(eventArgs).to.include({ sender: accounts[0], value: '23' })

      await dummyToken.balanceOf(accounts[0]).should.eventually.eq('23')
      await dummyToken.totalSupply().should.eventually.eq('23')
      await web3.eth.getBalance(dummyToken.address).should.eventually.eq('23')

      await dummyToken.deposit({ from: accounts[1], value: 101 })
      await dummyToken.balanceOf(accounts[0]).should.eventually.eq('23')
      await dummyToken.balanceOf(accounts[1]).should.eventually.eq('101')
      await dummyToken.totalSupply().should.eventually.eq('124')
      await web3.eth.getBalance(dummyToken.address).should.eventually.eq('124')

      const newBal0 = await getBalance(accounts[0])
      const newBal1 = await getBalance(accounts[1])

      expect(bal0.sub(newBal0).gt(23)).to.eq(true)
      expect(bal1.sub(newBal1).gt(101)).to.eq(true)
    })

    it('withdraw()', async () => {
      await dummyToken.deposit({ value: 23 })
      await dummyToken.deposit({ from: accounts[1], value: 9 })

      const ret = await dummyToken.withdraw(12)

      const eventArgs = extractEventArgs(ret, events.Withdrawal)
      expect(eventArgs).to.include({ receiver: accounts[0], value: '12' })

      await dummyToken.withdraw(4, { from: accounts[1] })

      await dummyToken.totalSupply().should.eventually.eq(16)
      await web3.eth.getBalance(dummyToken.address).should.eventually.eq('16')
    })

    it('withdraw() fails if insufficent balance', async () => {
      await dummyToken.deposit({ value: 23 })
      await dummyToken.withdraw(24).should.be.rejectedWith('DummyToken: insufficient balance')
    })
  })

  describe('supports ERC20 operations', () => {
    let tkn
    let tknSupply

    beforeEach(async () => {
      await dummyToken.deposit({ value: 1000 })
      tkn = await IERC20.at(dummyToken.address)
      tknSupply = await tkn.totalSupply()
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
      it('but not when sender does not have enough', async () => {
        await tkn.transfer(accounts[1], tknSupply + 1).should.be.rejectedWith('DummyToken: transfer amount exceeds balance')
      })

      it('but not when recipient is null', async () => {
        await tkn.transfer(ADDRESS_ZERO, tknSupply).should.be.rejectedWith('DummyToken: transfer to the zero address')
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
      it('but not if sender is not approved', async () => {
        await tkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[0] }).should.be.rejectedWith('DummyToken: transfer amount exceeds allowance')
      })

      it('but not when sender is null', async () => {
        await tkn.approve(ADDRESS_ZERO, 5).should.be.rejectedWith('DummyToken: approve to the zero address')
      })

      it('but not if sender exceeds their approved limit', async () => {
        await tkn.approve(accounts[1], 2).should.be.fulfilled
        await tkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[1] }).should.be.rejectedWith('DummyToken: transfer amount exceeds allowance')
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
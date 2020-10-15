import { extractEventArgs, ADDRESS_ZERO, EvmSnapshot } from './utils'
import { events } from '../'

const IERC20 = artifacts.require("./base/IERC20")
const DummyToken = artifacts.require("./DummyToken")

contract('DummyToken', accounts => {
  let dummyToken

  beforeEach(async () => {
    dummyToken = await DummyToken.new('Dummy token', 'DUM', 8, '100000000')
  })

  it('sets up default values', async () => {
    await dummyToken.name().should.eventually.eq('Dummy token')
    await dummyToken.symbol().should.eventually.eq('DUM')
    await dummyToken.decimals().should.eventually.eq('8')
    await dummyToken.totalSupply().should.eventually.eq('100000000')
    await dummyToken.balanceOf(accounts[0]).should.eventually.eq('100000000')
  })

  describe('mint', () => {
    it('mint()', async () => {
      const ret = await dummyToken.mint(23)

      await dummyToken.balanceOf(accounts[0]).should.eventually.eq('100000023')
      await dummyToken.totalSupply().should.eventually.eq('100000023')

      const eventArgs = extractEventArgs(ret, events.Mint)
      expect(eventArgs).to.include({ sender: accounts[0], amount: '23' })
    })
  })

  describe('supports ERC20 operations', () => {
    let tkn
    let tknSupply

    beforeEach(async () => {
      await dummyToken.mint(1000)
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
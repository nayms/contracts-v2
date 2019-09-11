import { toHex, toWei, sha3 } from 'web3-utils'

import { setupGlobalHooks, extractEventArgs, hdWallet } from './utils'
import { events } from '../'

const ACL = artifacts.require("./base/ACL.sol")
const IProxyImpl = artifacts.require("./base/IProxyImpl.sol")
const IFUCImpl = artifacts.require("./base/IFUCImpl.sol")
const IERC20 = artifacts.require("./base/IERC20.sol")
const IERC777 = artifacts.require("./base/IERC777.sol")
const FUC = artifacts.require("./FUC.sol")
const FUCImpl = artifacts.require("./FUCImpl.sol")

setupGlobalHooks()

contract('FUC', accounts => {
  let acl
  let fucImpl
  let fucProxy
  let fuc

  beforeEach(async () => {
    acl = await ACL.deployed()
    fucImpl = await FUCImpl.deployed()
    fucProxy = await FUC.new(
      acl.address, "acme",
      fucImpl.address,
      "fuc1"
    )
    // now let's speak to FUC contract using FUCImpl ABI
    fuc = await IFUCImpl.at(fucProxy.address)
  })

  it('can be deployed', async () => {
    expect(fucProxy.address).to.exist
  })

  it('has its name set during deployment', async () => {
    await fuc.getName().should.eventually.eq('fuc1')
  })

  it('can return its implementation version', async () => {
    await fucImpl.getImplementationVersion().should.eventually.eq('v1')
  })

  describe('can have its name set', () => {
    it('but not just by anyone', async () => {
      await fuc.setName('fuc2').should.be.rejectedWith('unauthorized');
    })

    it('if caller is an asset manager', async () => {
      await acl.assignRole("acme", accounts[0], sha3("roleAssetManager"))
      await fuc.setName('fuc2').should.be.fulfilled;
      await fuc.getName().should.eventually.eq('fuc2')
    })

    it('if caller is an asset manager agent', async () => {
      await acl.assignRole("acme", accounts[0], sha3("roleAssetManagerAgent"))
      await fuc.setName('fuc2').should.be.fulfilled;
      await fuc.getName().should.eventually.eq('fuc2')
    })
  })

  describe('it can be upgraded', async () => {
    let fucImpl2
    let randomSig
    let assetMgrSig
    let clientMgrSig

    beforeEach(async () => {
      // assign asset manager
      const assetMgrRole = await fucProxy.getAssetManagerRole()
      await acl.assignRole("acme", accounts[3], assetMgrRole)

      const clientMgrRole = await fucProxy.getClientManagerRole()
      await acl.assignRole("acme", accounts[4], clientMgrRole)

      // deploy new implementation
      fucImpl2 = await FUCImpl.new(acl.address, "fucImplementation")

      // generate upgrade approval signatures
      const implVersion = await fucImpl2.getImplementationVersion()
      randomSig = hdWallet.sign({ address: accounts[5], data: sha3(implVersion) })
      assetMgrSig = hdWallet.sign({ address: accounts[3], data: sha3(implVersion) })
      clientMgrSig = hdWallet.sign({ address: accounts[4], data: sha3(implVersion) })
    })

    it('but not just by anyone', async () => {
      await fucProxy.upgrade(fucImpl2.address, assetMgrSig, clientMgrSig, { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('but must have asset manager\'s approval', async () => {
      await fucProxy.upgrade(fucImpl2.address, randomSig, clientMgrSig).should.be.rejectedWith('must be approved by asset mgr')
    })

    it('but must have client manager\'s approval', async () => {
      await fucProxy.upgrade(fucImpl2.address, assetMgrSig, randomSig).should.be.rejectedWith('must be approved by client mgr')
    })

    it('and points to the new implementation', async () => {
      const result = await fucProxy.upgrade(fucImpl2.address, assetMgrSig, clientMgrSig).should.be.fulfilled

      expect(extractEventArgs(result, events.Upgraded)).to.include({
        implementation: fucImpl2.address,
        version: 'v1',
      })
    })
  })

  describe('tranches', () => {
    const tranchNumShares = [10, 50, 40]
    const tranchPricePerShare = [100, 200, 300]

    it('count must be greater than 0', async () => {
      await fuc.createTranches(0, [], []).should.be.rejectedWith('need atleast 1 tranch')
    })

    it('must have correct data', async () => {
      await fuc.createTranches(1, [1, 2], [1]).should.be.rejectedWith('num-shares array length mismatch')
      await fuc.createTranches(1, [1], [1, 2]).should.be.rejectedWith('price-per-share array length mismatch')
    })

    it('can be created', async () => {
      await fuc.createTranches(3, tranchNumShares, tranchPricePerShare).should.be.fulfilled

      await fuc.getNumTranches().should.eventually.eq(3)

      const addresses = {}

      await Promise.all(_.range(0, 3).map(async i => {
        const addr = await fuc.getTranch(i)

        expect(!addresses[addr]).to.be.true
        expect(addr.length).to.eq(42)
        addresses[addr] = true
      }))

      expect(Object.keys(addresses).length).to.eq(3)
    })

    it('can be created more than once', async () => {
      await fuc.createTranches(3, tranchNumShares, tranchPricePerShare).should.be.fulfilled
      await fuc.createTranches(3, tranchNumShares, tranchPricePerShare).should.be.fulfilled

      await fuc.getNumTranches().should.eventually.eq(6)

      const addresses = {}

      await Promise.all(_.range(0, 6).map(async i => {
        const addr = await fuc.getTranch(i)
        expect(!addresses[addr]).to.be.true
        expect(addr.length).to.eq(42)
        addresses[addr] = true
      }))

      expect(Object.keys(addresses).length).to.eq(6)
    })

    describe('are ERC20 tokens', () => {
      beforeEach(async () => {
        await fuc.createTranches(3, tranchNumShares, tranchPricePerShare)
        await fuc.createTranches(3, tranchNumShares, tranchPricePerShare)
      })

      it('which have basic details', async () => {
        let done = 0

        await Promise.all(_.range(0, 6).map(async i => {
          const tkn = await IERC20.at(await fuc.getTranch(i))

          const NAME = 'fuc1_tranch_\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000' + String.fromCodePoint(i)

          await tkn.name().should.eventually.eq(NAME)
          await tkn.symbol().should.eventually.eq(NAME)
          await tkn.totalSupply().should.eventually.eq(tranchNumShares[i % 3])
          await tkn.decimals().should.eventually.eq(18)

          done++
        }))

        expect(done).to.eq(6)
      })

      it('which have all supply initially allocated to creator', async () => {
        let done = 0

        await Promise.all(_.range(0, 6).map(async i => {
          const tkn = await IERC20.at(await fuc.getTranch(i))

          await tkn.balanceOf(accounts[0]).should.eventually.eq(await tkn.totalSupply())

          done++
        }))

        expect(done).to.eq(6)
      })

      describe('which support operations', () => {
        let firstTkn
        let firstTknNumShares

        beforeEach(async () => {
          firstTkn = await IERC20.at(await fuc.getTranch(0))
          firstTknNumShares = await firstTkn.totalSupply()
        })

        describe('such as transferring one\'s own tokens', () => {
          it('but not when sender does not have enough', async () => {
            await firstTkn.transfer(accounts[1], firstTknNumShares + 1).should.be.rejectedWith('not enough balance')
          })

          it('the entire balance of a user if need be', async () => {
            await firstTkn.transfer(accounts[1], firstTknNumShares).should.be.fulfilled

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(0)
            await firstTkn.balanceOf(accounts[1]).should.eventually.eq(firstTknNumShares)
          })

          it('when the sender has enough', async () => {
            await firstTkn.transfer(accounts[1], 5).should.be.fulfilled

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(firstTknNumShares - 5)
            await firstTkn.balanceOf(accounts[1]).should.eventually.eq(5)
          })
        })

        describe('such as transferring another person\'s tokens', () => {
          it('but not if sender is not approved', async () => {
            await firstTkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[0] }).should.be.rejectedWith('unauthorized')
          })

          it('but not if sender exceeds their approved limit', async () => {
            await firstTkn.approve(accounts[1], 2).should.be.fulfilled
            await firstTkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[1] }).should.be.rejectedWith('unauthorized')
          })

          it('if sender meets their approved limit', async () => {
            await firstTkn.approve(accounts[1], 5).should.be.fulfilled
            await firstTkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[1] }).should.be.fulfilled

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(firstTknNumShares - 5)
            await firstTkn.balanceOf(accounts[2]).should.eventually.eq(5)
          })
        })
      })
    })

    describe('are ERC777 tokens', () => {
      beforeEach(async () => {
        await fuc.createTranches(3, tranchNumShares, tranchPricePerShare)
        await fuc.createTranches(3, tranchNumShares, tranchPricePerShare)
      })

      it('which have basic details', async () => {
        let done = 0

        await Promise.all(_.range(0, 6).map(async i => {
          const tkn = await IERC777.at(await fuc.getTranch(i))

          const NAME = 'fuc1_tranch_\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000' + String.fromCodePoint(i)

          await tkn.name().should.eventually.eq(NAME)
          await tkn.symbol().should.eventually.eq(NAME)
          await tkn.totalSupply().should.eventually.eq(tranchNumShares[i % 3])
          await tkn.granularity().should.eventually.eq(1)

          done++
        }))

        expect(done).to.eq(6)
      })

      it('which have all supply initially allocated to creator', async () => {
        let done = 0

        await Promise.all(_.range(0, 6).map(async i => {
          const tkn = await IERC777.at(await fuc.getTranch(i))

          await tkn.balanceOf(accounts[0]).should.eventually.eq(await tkn.totalSupply())

          done++
        }))

        expect(done).to.eq(6)
      })

      it('which have an empty list of default operators', async () => {
        let done = 0

        await Promise.all(_.range(0, 6).map(async i => {
          const tkn = await IERC777.at(await fuc.getTranch(i))

          await tkn.defaultOperators().should.eventually.eq([])

          done++
        }))

        expect(done).to.eq(6)
      })
    })
  })
})

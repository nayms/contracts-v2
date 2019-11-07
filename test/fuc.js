import { toHex, toWei, sha3, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
} from './utils'
import { events } from '../'

import {
  ensureErc1820RegistryIsDeployed,
  ERC1820_DEPLOYED_ADDRESS,
  TOKENS_SENDER_INTERFACE_HASH,
  TOKENS_RECIPIENT_INTERFACE_HASH
} from '../migrations/utils/erc1820'

import { ensureEtherTokenIsDeployed } from '../migrations/utils/etherToken'

const ACL = artifacts.require("./base/ACL")
const IProxyImpl = artifacts.require("./base/IProxyImpl")
const IFUCImpl = artifacts.require("./base/IFUCImpl")
const IERC20 = artifacts.require("./base/IERC20")
const IERC777 = artifacts.require("./base/IERC777")
const FUC = artifacts.require("./FUC")
const FUCImpl = artifacts.require("./FUCImpl")
const IERC1820Registry = artifacts.require('./base/IERC1820Registry')
const DummyERC777TokensSender = artifacts.require('./test/DummyERC777TokensSender')
const DummyERC777TokensRecipient = artifacts.require('./test/DummyERC777TokensRecipient')
const ReEntrantERC777TokensSender = artifacts.require('./test/ReEntrantERC777TokensSender')
const ReEntrantERC777TokensRecipient = artifacts.require('./test/ReEntrantERC777TokensRecipient')

const DATA_BYTES = asciiToHex('test')
const DATA_BYTES_2 = asciiToHex('test2')

contract('FUC', accounts => {
  let acl
  let fucImpl
  let fucProxy
  let fuc
  let erc1820Registry
  let etherTokenAddress

  before(async () => {
    await ensureErc1820RegistryIsDeployed({ artifacts, accounts, web3 })
    etherTokenAddress = await ensureEtherTokenIsDeployed({ artifacts, accounts, web3 })
  })

  beforeEach(async () => {
    acl = await ACL.new()
    fucImpl = await FUCImpl.new(acl.address, "acme")
    fucProxy = await FUC.new(
      acl.address, "acme",
      fucImpl.address,
      "fuc1"
    )
    // now let's speak to FUC contract using FUCImpl ABI
    fuc = await IFUCImpl.at(fucProxy.address)

    erc1820Registry = await IERC1820Registry.at(ERC1820_DEPLOYED_ADDRESS)
  })

  it('must be deployed with a valid implementation', async () => {
    await FUC.new(
      acl.address, "acme",
      ADDRESS_ZERO,
      "fuc1"
    ).should.be.rejectedWith('implementation must be valid')
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

    it('if caller has correct ability', async () => {
      await acl.assignRole("acme", accounts[2], await fucProxy.ROLE_ASSET_MANAGER())
      await fuc.setName('fuc2', { from: accounts[2] }).should.be.fulfilled;
      await fuc.getName().should.eventually.eq('fuc2')
    })
  })

  describe('implements access control', async () => {
    beforeEach(async () => {
      const roles = await Promise.all([
        fucProxy.ROLE_ASSET_MANAGER(),
        fucProxy.ROLE_CLIENT_MANAGER(),
      ])

      expect(roles.length).to.eq(4)

      await Promise.all([
        acl.assignRole("acme", accounts[3], roles[0]),
        acl.assignRole("acme", accounts[5], roles[1]),
      ])
    })

    it('and can confirm if someone is an asset manager', async () => {
      await fucProxy.isAssetManager(accounts[0]).should.eventually.eq(false)
      await fucProxy.isAssetManager(accounts[3]).should.eventually.eq(true)
      await fucProxy.isAssetManager(accounts[4]).should.eventually.eq(false)
      await fucProxy.isAssetManager(accounts[5]).should.eventually.eq(false)
      await fucProxy.isAssetManager(accounts[6]).should.eventually.eq(false)
    })

    it('and can confirm if someone is a client manager', async () => {
      await fucProxy.isClientManager(accounts[0]).should.eventually.eq(false)
      await fucProxy.isClientManager(accounts[3]).should.eventually.eq(false)
      await fucProxy.isClientManager(accounts[4]).should.eventually.eq(false)
      await fucProxy.isClientManager(accounts[5]).should.eventually.eq(true)
      await fucProxy.isClientManager(accounts[6]).should.eventually.eq(false)
    })
  })

  describe('it can be upgraded', async () => {
    let fucImpl2
    let randomSig
    let assetMgrSig
    let clientMgrSig

    beforeEach(async () => {
      // assign asset manager
      const assetMgrRole = await fucProxy.ROLE_ASSET_MANAGER()
      await acl.assignRole("acme", accounts[3], assetMgrRole)

      const clientMgrRole = await fucProxy.ROLE_CLIENT_MANAGER()
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

    it('but not to an empty address', async () => {
      await fucProxy.upgrade(ADDRESS_ZERO, assetMgrSig, clientMgrSig).should.be.rejectedWith('implementation must be valid')
    })

    it('but not if signatures are empty', async () => {
      await fucProxy.upgrade(fucImpl.address, "0x0", "0x0").should.be.rejectedWith('valid signer not found')
    })

    it('but not to the existing implementation', async () => {
      await fucProxy.upgrade(fucImpl.address, assetMgrSig, clientMgrSig).should.be.rejectedWith('already this implementation')
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

    beforeEach(async () => {
      acl.assignRole("acme", accounts[2], await fuc.ROLE_ASSET_MANAGER())
    })

    it('cannot be created without correct ability', async () => {
      await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress).should.be.rejectedWith('unauthorized')
    })

    it('count must be greater than 0', async () => {
      await fuc.createTranches([], [], etherTokenAddress, { from: accounts[2] }).should.be.rejectedWith('need atleast 1 tranch')
    })

    it('must have correct data', async () => {
      await fuc.createTranches([1, 2], [1], etherTokenAddress, { from: accounts[2] }).should.be.rejectedWith('price-per-share array length mismatch')
      await fuc.createTranches([1], [1, 2], etherTokenAddress, { from: accounts[2] }).should.be.rejectedWith('price-per-share array length mismatch')
    })

    it('can be created', async () => {
      const result = await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress, { from: accounts[2] }).should.be.fulfilled

      const logs = parseEvents(result, events.CreateTranch)

      expect(logs.length).to.eq(3)

      for (let i = 0; 3 > i; i += 1) {
        expect(logs[i].args.fuc).to.eq(fuc.address)
        expect(logs[i].args.tranch).to.eq(await fuc.getTranch(i))
        expect(logs[i].args.index).to.eq(`${i}`)
      }

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
      await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress, { from: accounts[2] }).should.be.fulfilled
      await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress, { from: accounts[2] }).should.be.fulfilled

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
        acl.assignRole("acme", accounts[0], await fuc.ROLE_ASSET_MANAGER())
        await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress)
        await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress)
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

        it('such as approving an address to send on one\'s behalf', async () => {
          const result = await firstTkn.approve(accounts[1], 2).should.be.fulfilled

          expect(extractEventArgs(result, events.Approval)).to.include({
            owner: accounts[0],
            spender: accounts[1],
            value: '2',
          })

          await firstTkn.allowance(accounts[0], accounts[1]).should.eventually.eq(2)
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
            const result = await firstTkn.transfer(accounts[1], 5).should.be.fulfilled

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(firstTknNumShares - 5)
            await firstTkn.balanceOf(accounts[1]).should.eventually.eq(5)

            expect(extractEventArgs(result, events.Transfer)).to.include({
              from: accounts[0],
              to: accounts[1],
              value: '5',
            })
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

            const result =
              await firstTkn.transferFrom(accounts[0], accounts[2], 5, { from: accounts[1] }).should.be.fulfilled

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(firstTknNumShares - 5)
            await firstTkn.balanceOf(accounts[2]).should.eventually.eq(5)

            expect(extractEventArgs(result, events.Transfer)).to.include({
              from: accounts[0],
              to: accounts[2],
              value: '5',
            })
          })
        })
      })
    })

    describe('are ERC777 tokens', () => {
      beforeEach(async () => {
        acl.assignRole("acme", accounts[0], await fuc.ROLE_ASSET_MANAGER())
        await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress)
        await fuc.createTranches(tranchNumShares, tranchPricePerShare, etherTokenAddress)
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

      describe('which support operations', () => {
        let firstTkn
        let firstTknNumShares

        beforeEach(async () => {
          firstTkn = await IERC777.at(await fuc.getTranch(0))
          firstTknNumShares = await firstTkn.totalSupply()
        })

        describe('such as transferring someone else\'s tokens', () => {
          it('but not when operator is not approved', async () => {
            await firstTkn.operatorSend(accounts[0], accounts[1], 1, DATA_BYTES, DATA_BYTES_2, { from: accounts[1] }).should.be.rejectedWith('not authorized')
          })

          it('when operator is approved', async () => {
            const result1 = await firstTkn.authorizeOperator(accounts[1]).should.be.fulfilled

            expect(extractEventArgs(result1, events.AuthorizedOperator)).to.include({
              operator: accounts[1],
              tokenHolder: accounts[0],
            })

            await firstTkn.isOperatorFor(accounts[1], accounts[0]).should.eventually.eq(true)

            const result2 = await firstTkn.operatorSend(accounts[0], accounts[1], 1, DATA_BYTES, DATA_BYTES_2, { from: accounts[1] }).should.be.fulfilled

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(firstTknNumShares - 1)
            await firstTkn.balanceOf(accounts[1]).should.eventually.eq(1)

            expect(extractEventArgs(result2, events.Transfer)).to.include({
              from: accounts[0],
              to: accounts[1],
              value: '1',
            })

            expect(extractEventArgs(result2, events.Sent)).to.include({
              operator: accounts[1],
              from: accounts[0],
              to: accounts[1],
              amount: '1',
              data: DATA_BYTES,
              operatorData: DATA_BYTES_2,
            })
          })

          it('but not when sending to null address', async () => {
            await firstTkn.authorizeOperator(accounts[1]).should.be.fulfilled
            await firstTkn.operatorSend(accounts[0], ADDRESS_ZERO, 1, DATA_BYTES, DATA_BYTES_2, { from: accounts[1] }).should.be.rejectedWith('cannot send to zero address')
          })

          it('but not when an operator has been revoked', async () => {
            await firstTkn.authorizeOperator(accounts[1]).should.be.fulfilled

            const result = await firstTkn.revokeOperator(accounts[1]).should.be.fulfilled

            expect(extractEventArgs(result, events.RevokedOperator)).to.include({
              operator: accounts[1],
              tokenHolder: accounts[0],
            })

            await firstTkn.isOperatorFor(accounts[1], accounts[0]).should.eventually.eq(false)

            await firstTkn.operatorSend(accounts[0], accounts[1], 1, DATA_BYTES, DATA_BYTES_2, { from: accounts[1] }).should.be.rejectedWith('not authorized')
          })
        })

        describe('such as transferring one\'s own tokens', () => {
          it('but not when sender does not have enough', async () => {
            await firstTkn.send(accounts[1], firstTknNumShares + 1, DATA_BYTES).should.be.rejectedWith('not enough balance')
          })

          it('but not when recipient is null address', async () => {
            await firstTkn.send(ADDRESS_ZERO, 1, DATA_BYTES).should.be.rejectedWith('cannot send to zero address')
          })

          it('when the balance is enough', async () => {
            const result = await firstTkn.send(accounts[1], 1, DATA_BYTES).should.be.fulfilled

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(firstTknNumShares - 1)
            await firstTkn.balanceOf(accounts[1]).should.eventually.eq(1)

            expect(extractEventArgs(result, events.Transfer)).to.include({
              from: accounts[0],
              to: accounts[1],
              value: '1',
            })

            expect(extractEventArgs(result, events.Sent)).to.include({
              operator: accounts[0],
              from: accounts[0],
              to: accounts[1],
              amount: '1',
              data: DATA_BYTES,
              operatorData: null,
            })
          })
        })

        describe('involving ERC1820 registry', () => {
          beforeEach(async () => {
            await erc1820Registry.setInterfaceImplementer(
              accounts[0],
              TOKENS_SENDER_INTERFACE_HASH,
              ADDRESS_ZERO,
              { from: accounts[0] }
            );

            await erc1820Registry.setInterfaceImplementer(
              accounts[1],
              TOKENS_RECIPIENT_INTERFACE_HASH,
              ADDRESS_ZERO,
              { from: accounts[1] }
            )
          })

          afterEach(async () => {
            await erc1820Registry.setInterfaceImplementer(
              accounts[0],
              TOKENS_SENDER_INTERFACE_HASH,
              ADDRESS_ZERO,
              { from: accounts[0] }
            );

            await erc1820Registry.setInterfaceImplementer(
              accounts[1],
              TOKENS_RECIPIENT_INTERFACE_HASH,
              ADDRESS_ZERO,
              { from: accounts[1] }
            )
          })

          describe('and if sender has registered a handler', () => {
            describe('when it\'s a dummy handler', () => {
              beforeEach(async () => {
                const dummyERC777TokenSender = await DummyERC777TokensSender.new()

                await erc1820Registry.setInterfaceImplementer(
                  accounts[0],
                  TOKENS_SENDER_INTERFACE_HASH,
                  dummyERC777TokenSender.address,
                  { from: accounts[0] }
                )
              })

              it('then the handler gets invoked during a transfer', async () => {
                const result = await firstTkn.send(accounts[1], 1, DATA_BYTES).should.be.fulfilled

                expect(extractEventArgs(result, events.TokensToSend)).to.include({
                  operator: accounts[0],
                  from: accounts[0],
                  to: accounts[1],
                  amount: '1',
                  userData: DATA_BYTES,
                  operatorData: null,
                })
              })

              it('then operator data also gets passed to the handler', async () => {
                await firstTkn.authorizeOperator(accounts[1]).should.be.fulfilled

                const result = await firstTkn.operatorSend(accounts[0], accounts[1], 1, DATA_BYTES, DATA_BYTES_2, { from: accounts[1] }).should.be.fulfilled

                expect(extractEventArgs(result, events.TokensToSend)).to.include({
                  operator: accounts[1],
                  from: accounts[0],
                  to: accounts[1],
                  amount: '1',
                  userData: DATA_BYTES,
                  operatorData: DATA_BYTES_2,
                })
              })
            })

            describe('when it\'s a re-entrant handler', () => {
              beforeEach(async () => {
                const reEntrantERC777TokenSender = await ReEntrantERC777TokensSender.new(
                  fucProxy.address,
                  0
                )

                await erc1820Registry.setInterfaceImplementer(
                  accounts[0],
                  TOKENS_SENDER_INTERFACE_HASH,
                  reEntrantERC777TokenSender.address,
                  { from: accounts[0] }
                )
              })

              it('then mutex prevents transaction succeeding', async () => {
                await firstTkn.send(accounts[1], 1, DATA_BYTES).should.be.rejectedWith('ERC777 sender mutex already acquired')
              })
            })
          })

          describe('and if receiver has registered a handler', () => {
            describe('when it\'s a dummy handler', () => {
              beforeEach(async () => {
                const dummyERC777TokensRecipient = await DummyERC777TokensRecipient.new()

                await erc1820Registry.setInterfaceImplementer(
                  accounts[1],
                  TOKENS_RECIPIENT_INTERFACE_HASH,
                  dummyERC777TokensRecipient.address,
                  { from: accounts[1] }
                )
              })

              it('then the handler gets invoked during a transfer', async () => {
                const result = await firstTkn.send(accounts[1], 1, DATA_BYTES).should.be.fulfilled

                expect(extractEventArgs(result, events.TokensReceived)).to.include({
                  operator: accounts[0],
                  from: accounts[0],
                  to: accounts[1],
                  amount: '1',
                  userData: DATA_BYTES,
                  operatorData: null,
                })
              })

              it('then operator data also gets passed to the handler', async () => {
                await firstTkn.authorizeOperator(accounts[1]).should.be.fulfilled

                const result = await firstTkn.operatorSend(accounts[0], accounts[1], 1, DATA_BYTES, DATA_BYTES_2, { from: accounts[1] }).should.be.fulfilled

                expect(extractEventArgs(result, events.TokensReceived)).to.include({
                  operator: accounts[1],
                  from: accounts[0],
                  to: accounts[1],
                  amount: '1',
                  userData: DATA_BYTES,
                  operatorData: DATA_BYTES_2,
                })
              })
            })

            describe('when it\'s a re-entrant handler', () => {
              beforeEach(async () => {
                const reEntrantERC777TokenRecipient = await ReEntrantERC777TokensRecipient.new(
                  fucProxy.address,
                  0
                )

                await erc1820Registry.setInterfaceImplementer(
                  accounts[1],
                  TOKENS_RECIPIENT_INTERFACE_HASH,
                  reEntrantERC777TokenRecipient.address,
                  { from: accounts[1] }
                )
              })

              it('then mutex prevents transaction succeeding', async () => {
                await firstTkn.send(accounts[1], 1, DATA_BYTES).should.be.rejectedWith('ERC777 receiver mutex already acquired')
              })
            })
          })

          describe('and if receiver is a contract and it has not registered a handler', () => {
            it('then it reverts', async () => {
              await firstTkn.send(fucImpl.address, 1, DATA_BYTES).should.be.rejectedWith('has no implementer')
            })
          })
        })
      })
    })
  })
})

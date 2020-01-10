import { sha3, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  testEvents,
  createTranch,
} from './utils'
import { events } from '../'

import {
  ensureErc1820RegistryIsDeployed,
  TOKENS_SENDER_INTERFACE_HASH,
  TOKENS_RECIPIENT_INTERFACE_HASH
} from '../migrations/utils/erc1820'

import {
  ensureAclIsDeployed,
  ROLE_ASSET_MANAGER,
  ROLE_CLIENT_MANAGER,
  ROLE_ENTITY_ADMIN,
  ROLE_ENTITY_MANAGER,
} from '../migrations/utils/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/utils/etherToken'

const IERC20 = artifacts.require("./base/IERC20")
const IERC777 = artifacts.require("./base/IERC777")
const EntityDeployer = artifacts.require('./EntityDeployer')
const IEntityImpl = artifacts.require('./base/IEntityImpl')
const EntityImpl = artifacts.require('./EntityImpl')
const Entity = artifacts.require('./Entity')
const IPolicyImpl = artifacts.require("./base/IPolicyImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const Policy = artifacts.require("./Policy")
const TestPolicyImpl = artifacts.require("./test/TestPolicyImpl")
const DummyERC777TokensSender = artifacts.require('./test/DummyERC777TokensSender')
const DummyERC777TokensRecipient = artifacts.require('./test/DummyERC777TokensRecipient')
const ReEntrantERC777TokensSender = artifacts.require('./test/ReEntrantERC777TokensSender')
const ReEntrantERC777TokensRecipient = artifacts.require('./test/ReEntrantERC777TokensRecipient')

const DATA_BYTES = asciiToHex('test')
const DATA_BYTES_2 = asciiToHex('test2')

contract('Policy', accounts => {
  let acl
  let entityDeployer
  let entityImpl
  let entityProxy
  let entity
  let entityContext
  let policyImpl
  let policyProxy
  let policy
  let policyContext
  let entityManagerAddress
  let erc1820Registry
  let etherToken

  beforeEach(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })

    // registry + wrappedEth
    erc1820Registry = await ensureErc1820RegistryIsDeployed({ artifacts, accounts, web3 })
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address)

    // entity
    entityImpl = await EntityImpl.new(acl.address)
    entityDeployer = await EntityDeployer.new(acl.address, entityImpl.address)

    const deployEntityTx = await entityDeployer.deploy('acme')
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntityImpl.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(entityContext, accounts[1], ROLE_ENTITY_ADMIN)
    await acl.assignRole(entityContext, accounts[2], ROLE_ENTITY_MANAGER)
    entityManagerAddress = accounts[2]

    policyImpl = await PolicyImpl.new(acl.address)

    const createPolicyTx = await entity.createPolicy(policyImpl.address, 'doom', { from: entityManagerAddress })
    const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy

    policyProxy = await Policy.at(policyAddress)
    policy = await IPolicyImpl.at(policyAddress)
    policyContext = await policyProxy.aclContext()
  })

  it('can be deployed', async () => {
    expect(policyProxy.address).to.exist
  })

  it('has its name set during deployment', async () => {
    await policy.getName().should.eventually.eq('doom')
  })

  it('can return its implementation version', async () => {
    await policyImpl.getImplementationVersion().should.eventually.eq('v1')
  })

  describe('can have its name set', () => {
    it('but not just by anyone', async () => {
      await policy.setName('policy2').should.be.rejectedWith('must be policy manager');
    })

    it('if caller has correct ability', async () => {
      await policy.setName('policy2', { from: entityManagerAddress }).should.be.fulfilled;
      await policy.getName().should.eventually.eq('policy2')
    })
  })

  describe('it can be upgraded', async () => {
    let policyImpl2
    let randomSig
    let assetMgrSig
    let clientMgrSig

    beforeEach(async () => {
      // assign roles
      await acl.assignRole(policyContext, accounts[3], ROLE_ASSET_MANAGER)
      await acl.assignRole(policyContext, accounts[4], ROLE_CLIENT_MANAGER)

      // deploy new implementation
      policyImpl2 = await TestPolicyImpl.new()

      // generate upgrade approval signatures
      const implVersion = await policyImpl2.getImplementationVersion()
      randomSig = hdWallet.sign({ address: accounts[5], data: sha3(implVersion) })
      assetMgrSig = hdWallet.sign({ address: accounts[3], data: sha3(implVersion) })
      clientMgrSig = hdWallet.sign({ address: accounts[4], data: sha3(implVersion) })
    })

    it('but not just by anyone', async () => {
      await policyProxy.upgrade(policyImpl2.address, assetMgrSig, clientMgrSig, { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('but must have asset manager\'s approval', async () => {
      await policyProxy.upgrade(policyImpl2.address, randomSig, clientMgrSig).should.be.rejectedWith('must be approved by asset manager')
    })

    it('but must have client manager\'s approval', async () => {
      await policyProxy.upgrade(policyImpl2.address, assetMgrSig, randomSig).should.be.rejectedWith('must be approved by client manager')
    })

    it('but not to an empty address', async () => {
      await policyProxy.upgrade(ADDRESS_ZERO, assetMgrSig, clientMgrSig).should.be.rejectedWith('implementation must be valid')
    })

    it('but not if signatures are empty', async () => {
      await policyProxy.upgrade(policyImpl2.address, "0x0", "0x0").should.be.rejectedWith('valid signer not found')
    })

    it('but not to the existing implementation', async () => {
      const vExisting = await policyImpl.getImplementationVersion()
      assetMgrSig = hdWallet.sign({ address: accounts[3], data: sha3(vExisting) })
      clientMgrSig = hdWallet.sign({ address: accounts[4], data: sha3(vExisting) })
      await policyProxy.upgrade(policyImpl.address, assetMgrSig, clientMgrSig).should.be.rejectedWith('already this implementation')
    })

    it('and points to the new implementation', async () => {
      const result = await policyProxy.upgrade(policyImpl2.address, assetMgrSig, clientMgrSig).should.be.fulfilled

      expect(extractEventArgs(result, events.Upgraded)).to.include({
        implementation: policyImpl2.address,
        version: 'vTest',
      })
    })
  })

  describe('tranches', () => {
    const tranchNumShares = 10
    const tranchPricePerShare = 100

    beforeEach(async () => {
      await acl.assignRole(entityContext, accounts[2], ROLE_ENTITY_MANAGER)
    })

    it('cannot be created without correct authorization', async () => {
      await createTranch(policy, { denominationUnit: etherToken.address }).should.be.rejectedWith('must be policy manager')
    })

    it('all values must be valid', async () => {
      await createTranch(policy, { denominationUnit: etherToken.address, numShares: 0 }, { from: accounts[2] }).should.be.rejectedWith('invalid num of shares')
      await createTranch(policy, { denominationUnit: etherToken.address, pricePerShareAmount: 0 }, { from: accounts[2] }).should.be.rejectedWith('invalid price')
      await createTranch(policy, { denominationUnit: etherToken.address, premiumAmount: 0 }, { from: accounts[2] }).should.be.rejectedWith('invalid premium')
      await createTranch(policy, { denominationUnit: etherToken.address, premiumIntervalSeconds: 0 }, { from: accounts[2] }).should.be.rejectedWith('invalid premium interval')
      await createTranch(policy, {}, { from: accounts[2] }).should.be.rejectedWith('invalid denomination unit')
    })

    it('can be created and have initial balance auto-allocated to policy impl', async () => {
      const result = await createTranch(policy, {
        numShares: tranchNumShares,
        pricePerShareAmount: tranchPricePerShare,
        denominationUnit: etherToken.address,
      }, {
        from: accounts[2]
      }).should.be.fulfilled

      const [ log ] = parseEvents(result, events.CreateTranch)

      expect(log.args.policy).to.eq(policy.address)
      expect(log.args.tranch).to.eq(await policy.getTranchToken(0))
      expect(log.args.initialBalanceHolder).to.eq(policy.address)
      expect(log.args.index).to.eq('0')

      await policy.getNumTranches().should.eventually.eq(1)
      const addr = await policy.getTranchToken(0)
      expect(addr.length).to.eq(42)
    })

    it('can be created and have initial balance allocated to a specific address', async () => {
      const result = await createTranch(policy, {
        numShares: tranchNumShares,
        pricePerShareAmount: tranchPricePerShare,
        denominationUnit: etherToken.address,
        initialBalanceHolder: accounts[3],
      }, {
        from: accounts[2]
      }).should.be.fulfilled

      const [ log ] = parseEvents(result, events.CreateTranch)

      expect(log.args.initialBalanceHolder).to.eq(accounts[3])
    })

    it('can be created and will have state set to CREATED', async () => {
      await createTranch(policy, {
        numShares: tranchNumShares,
        pricePerShareAmount: tranchPricePerShare,
        denominationUnit: etherToken.address,
        initialBalanceHolder: accounts[3],
      }, {
        from: accounts[2]
      }).should.be.fulfilled

      await policy.getTranchStatus(0).should.eventually.eq(await policy.STATE_CREATED())
    })

    it('can be created more than once', async () => {
      await createTranch(policy, {
        numShares: tranchNumShares,
        pricePerShareAmount: tranchPricePerShare,
        denominationUnit: etherToken.address,
      }, {
        from: accounts[2]
      }).should.be.fulfilled

      await createTranch(policy, {
        numShares: tranchNumShares + 1,
        pricePerShareAmount: tranchPricePerShare + 2,
        denominationUnit: etherToken.address,
      }, {
        from: accounts[2]
      }).should.be.fulfilled

      await policy.getNumTranches().should.eventually.eq(2)

      const addresses = {}

      await Promise.all(_.range(0, 2).map(async i => {
        const addr = await policy.getTranchToken(i)
        expect(!addresses[addr]).to.be.true
        expect(addr.length).to.eq(42)
        addresses[addr] = true
      }))

      expect(Object.keys(addresses).length).to.eq(2)
    })

    describe('are ERC20 tokens', () => {
      beforeEach(async () => {
        acl.assignRole(entityContext, accounts[0], ROLE_ENTITY_MANAGER)

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          denominationUnit: etherToken.address,
          initialBalanceHolder: accounts[0],
        }).should.be.fulfilled

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          denominationUnit: etherToken.address,
          initialBalanceHolder: accounts[0],
        }).should.be.fulfilled
      })

      it('which have basic details', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC20.at(await policy.getTranchToken(i))

          const NAME = 'doom_tranch_\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000' + String.fromCodePoint(i)

          await tkn.name().should.eventually.eq(NAME)
          await tkn.symbol().should.eventually.eq(NAME)
          await tkn.totalSupply().should.eventually.eq(tranchNumShares)
          await tkn.decimals().should.eventually.eq(18)

          done++
        }))

        expect(done).to.eq(2)
      })

      it('which have all supply initially allocated to initial balance holder', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC20.at(await policy.getTranchToken(i))

          await tkn.balanceOf(accounts[0]).should.eventually.eq(await tkn.totalSupply())

          done++
        }))

        expect(done).to.eq(2)
      })

      describe('which support operations', () => {
        let firstTkn
        let firstTknNumShares

        beforeEach(async () => {
          firstTkn = await IERC20.at(await policy.getTranchToken(0))
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
        acl.assignRole(entityContext, accounts[0], ROLE_ENTITY_MANAGER)

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          denominationUnit: etherToken.address,
          initialBalanceHolder: accounts[0],
        }).should.be.fulfilled

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          denominationUnit: etherToken.address,
          initialBalanceHolder: accounts[0],
        }).should.be.fulfilled
      })

      it('which have basic details', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC777.at(await policy.getTranchToken(i))

          const NAME = 'doom_tranch_\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000' + String.fromCodePoint(i)

          await tkn.name().should.eventually.eq(NAME)
          await tkn.symbol().should.eventually.eq(NAME)
          await tkn.totalSupply().should.eventually.eq(tranchNumShares)
          await tkn.granularity().should.eventually.eq(1)

          done++
        }))

        expect(done).to.eq(2)
      })

      it('which have all supply initially allocated to creator', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC777.at(await policy.getTranchToken(i))

          await tkn.balanceOf(accounts[0]).should.eventually.eq(await tkn.totalSupply())

          done++
        }))

        expect(done).to.eq(2)
      })

      it('which have an empty list of default operators', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC777.at(await policy.getTranchToken(i))

          await tkn.defaultOperators().should.eventually.eq([])

          done++
        }))

        expect(done).to.eq(2)
      })

      describe('which support operations', () => {
        let firstTkn
        let firstTknNumShares

        beforeEach(async () => {
          firstTkn = await IERC777.at(await policy.getTranchToken(0))
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

                expect(extractEventArgs(result, testEvents.TokensToSend)).to.include({
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

                expect(extractEventArgs(result, testEvents.TokensToSend)).to.include({
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
                  policyProxy.address,
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

                expect(extractEventArgs(result, testEvents.TokensReceived)).to.include({
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

                expect(extractEventArgs(result, testEvents.TokensReceived)).to.include({
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
                  policyProxy.address,
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
              await firstTkn.send(policyImpl.address, 1, DATA_BYTES).should.be.rejectedWith('has no implementer')
            })
          })
        })
      })
    })
  })
})

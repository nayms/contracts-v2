import { sha3, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
  createPolicy,
} from './utils'
import { events } from '../'

import { ROLES, ROLEGROUPS } from '../utils/constants'

import { deployAcl } from '../migrations/modules/acl'

import { deployEtherToken } from '../migrations/modules/etherToken'
import { deploySettings } from '../migrations/modules/settings'

const IERC20 = artifacts.require("./base/IERC20")
const EntityDeployer = artifacts.require('./EntityDeployer')
const IEntityImpl = artifacts.require('./base/IEntityImpl')
const EntityImpl = artifacts.require('./EntityImpl')
const Entity = artifacts.require('./Entity')
const IPolicyImpl = artifacts.require("./base/IPolicyImpl")
const PolicyImpl = artifacts.require("./PolicyImpl")
const Policy = artifacts.require("./Policy")
const TestPolicyImpl = artifacts.require("./test/TestPolicyImpl")

const DATA_BYTES = asciiToHex('test')
const DATA_BYTES_2 = asciiToHex('test2')

contract('Policy', accounts => {
  let acl
  let systemContext
  let settings
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
  let policyOwnerAddress
  let etherToken

  let setupPolicy

  beforeEach(async () => {
    // acl
    acl = await deployAcl({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await deploySettings({ artifacts }, acl.address)

    // registry + wrappedEth
    etherToken = await deployEtherToken({ artifacts }, acl.address, settings.address)

    // entity
    entityImpl = await EntityImpl.new(acl.address, settings.address)
    entityDeployer = await EntityDeployer.new(acl.address, settings.address, entityImpl.address)

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)
    const deployEntityTx = await entityDeployer.deploy()
    const entityAddress = extractEventArgs(deployEntityTx, events.NewEntity).entity

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntityImpl.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // policy
    await acl.assignRole(entityContext, accounts[1], ROLES.ENTITY_ADMIN)
    await acl.assignRole(entityContext, accounts[2], ROLES.ENTITY_MANAGER)
    entityManagerAddress = accounts[2]

    policyImpl = await PolicyImpl.new(acl.address, settings.address)

    setupPolicy = async ({
      initiationDateDiff = 1000,
      startDateDiff = 2000,
      maturationDateDiff = 3000,
      premiumIntervalSeconds = undefined,
      brokerCommissionBP = 0,
      assetManagerCommissionBP = 0,
      naymsCommissionBP = 0,
    } = {}) => {
      // get current evm time
      const t = await settings.getTime()
      const currentBlockTime = parseInt(t.toString(10))

      const createPolicyTx = await createPolicy(entity, policyImpl.address, {
        initiationDate: currentBlockTime + initiationDateDiff,
        startDate: currentBlockTime + startDateDiff,
        maturationDate: currentBlockTime + maturationDateDiff,
        unit: etherToken.address,
        premiumIntervalSeconds,
        brokerCommissionBP,
        assetManagerCommissionBP,
        naymsCommissionBP,
      }, { from: entityManagerAddress })
      const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicyImpl.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress
    }
  })

  describe('basic tests', () => {
    beforeEach(async () => {
      await setupPolicy()
    })

    it('can be deployed', async () => {
      expect(policyProxy.address).to.exist
    })

    it('can return its implementation version', async () => {
      await policyImpl.getImplementationVersion().should.eventually.eq('v1')
    })
  })

  describe('it can be upgraded', async () => {
    let policyImpl2
    let randomSig
    let assetMgrSig
    let clientMgrSig

    beforeEach(async () => {
      await setupPolicy()

      // assign roles
      await acl.assignRole(policyContext, accounts[3], ROLES.ASSET_MANAGER)
      await acl.assignRole(policyContext, accounts[4], ROLES.CLIENT_MANAGER)

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

    describe('basic tests', () => {
      it('cannot be created without correct authorization', async () => {
        await setupPolicy()
        await createTranch(policy, {}).should.be.rejectedWith('must be policy owner')
      })

      it('all basic values must be valid', async () => {
        await setupPolicy()
        await createTranch(policy, { numShares: 0 }, { from: policyOwnerAddress }).should.be.rejectedWith('invalid num of shares')
        await createTranch(policy, { pricePerShareAmount: 0 }, { from: policyOwnerAddress }).should.be.rejectedWith('invalid price')
      })

      it('and premium array is valid', async () => {
        await setupPolicy({ initiationDateDiff: 0, startDateDiff: 0, maturationDateDiff: 30, premiumIntervalSeconds: 20 })

        await createTranch(policy, { premiums: [1, 2, 3, 4, 5] }, { from: policyOwnerAddress }).should.be.rejectedWith('too many premiums')
      })

      it('can be created and have initial balance auto-allocated to policy impl', async () => {
        await setupPolicy()

        const result = await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        const [log] = parseEvents(result, events.CreateTranch)

        expect(log.args.policy).to.eq(policy.address)
        expect(log.args.tranch).to.eq(await policy.getTranchToken(0))
        expect(log.args.initialBalanceHolder).to.eq(policy.address)
        expect(log.args.index).to.eq('0')

        await policy.getNumTranches().should.eventually.eq(1)
        const addr = await policy.getTranchToken(0)
        expect(addr.length).to.eq(42)
      })

      it('can be created and have initial balance allocated to a specific address', async () => {
        await setupPolicy()

        const result = await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          initialBalanceHolder: accounts[3],
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        const [log] = parseEvents(result, events.CreateTranch)

        expect(log.args.initialBalanceHolder).to.eq(accounts[3])
      })

      it('can be created and will have state set to DRAFT', async () => {
        await setupPolicy()

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          initialBalanceHolder: accounts[3],
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        const draftState = await policy.STATE_DRAFT()
        await policy.getTranchState(0).should.eventually.eq(draftState)
      })

      it('can be created more than once', async () => {
        await setupPolicy()

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
        }, {
          from: accounts[2]
        }).should.be.fulfilled

        await createTranch(policy, {
          numShares: tranchNumShares + 1,
          pricePerShareAmount: tranchPricePerShare + 2,
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
    })

    describe('are ERC20 tokens', () => {
      beforeEach(async () => {
        await setupPolicy()

        acl.assignRole(policyContext, accounts[0], ROLES.POLICY_OWNER)

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          initialBalanceHolder: accounts[0],
        }).should.be.fulfilled

        await createTranch(policy, {
          numShares: tranchNumShares,
          pricePerShareAmount: tranchPricePerShare,
          initialBalanceHolder: accounts[0],
        }).should.be.fulfilled
      })

      it('which have basic details', async () => {
        let done = 0

        await Promise.all(_.range(0, 2).map(async i => {
          const tkn = await IERC20.at(await policy.getTranchToken(i))

          const NAME = `${policyProxy.address.toLowerCase()}_tranch_\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000` + String.fromCodePoint(i)

          await tkn.name().should.eventually.eq(NAME)
          await tkn.symbol().should.eventually.eq(NAME)
          await tkn.totalSupply().should.eventually.eq(tranchNumShares)
          await tkn.decimals().should.eventually.eq(18)
          await tkn.allowance(accounts[0], accounts[1]).should.eventually.eq(0)

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

        it('but sending one\'s own tokens is not possible', async () => {
          await firstTkn.transfer(accounts[0], firstTknNumShares).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('but approving an address to send on one\'s behalf is not possible', async () => {
          await firstTkn.approve(accounts[1], 2).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        describe('such as market sending tokens on one\' behalf', () => {
          beforeEach(async () => {
            await settings.setMatchingMarket(accounts[3]).should.be.fulfilled
          })

          it('but not when owner does not have enough', async () => {
            await firstTkn.transferFrom(accounts[0], accounts[2], firstTknNumShares + 1, { from: accounts[3] }).should.be.rejectedWith('not enough balance')
          })

          it('when the owner has enough', async () => {
            const result = await firstTkn.transferFrom(accounts[0], accounts[2], firstTknNumShares, { from: accounts[3] })

            await firstTkn.balanceOf(accounts[0]).should.eventually.eq(0)
            await firstTkn.balanceOf(accounts[2]).should.eventually.eq(firstTknNumShares)

            expect(extractEventArgs(result, events.Transfer)).to.include({
              from: accounts[0],
              to: accounts[2],
              value: `${firstTknNumShares}`,
            })
          })
        })
      })
    })

    describe('premiums', () => {
      describe('basic tests', () => {
        beforeEach(async () => {
          await setupPolicy()
        })

        it('initially no premium is expected', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await policy.getNextTranchPremiumAmount(0).should.eventually.eq(2)
          await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(0)
          await policy.tranchPaymentsAllMade(0).should.eventually.eq(false)
        })

        it('policy must have permission to receive premium payment token', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await etherToken.deposit({ value: 10 })
          await policy.payTranchPremium(0).should.be.rejectedWith('amount exceeds allowance')
        })

        it('sender must have enough tokens to make the payment', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await etherToken.deposit({ value: 1 })
          await etherToken.approve(policy.address, 2)
          await policy.payTranchPremium(0).should.be.rejectedWith('amount exceeds balance')
        })

        it('updates the internal stats once first payment is made', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await etherToken.deposit({ value: 2 })
          await etherToken.approve(policy.address, 2)
          await policy.payTranchPremium(0).should.be.fulfilled

          await policy.getNextTranchPremiumAmount(0).should.eventually.eq(3)
          await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(0)
          await policy.tranchPaymentsAllMade(0).should.eventually.eq(false)
        })

        it('updates the internal stats once subsequent payment is made', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await etherToken.deposit({ value: 5 })
          await etherToken.approve(policy.address, 5)
          await policy.payTranchPremium(0).should.be.fulfilled
          await policy.payTranchPremium(0).should.be.fulfilled

          await policy.getNextTranchPremiumAmount(0).should.eventually.eq(4)
          await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(0)
          await policy.tranchPaymentsAllMade(0).should.eventually.eq(false)
        })
      })

      describe('once initiation date has passed', () => {
        beforeEach(async () => {
          await setupPolicy({ initiationDateDiff: 0, startDateDiff: 2000, maturationDateDiff: 3000 })

          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })
        })

        it('it requires first payment to have been made', async () => {
          await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(1)
          await policy.getNextTranchPremiumAmount(0).should.eventually.eq(2)
          await policy.tranchPaymentsAllMade(0).should.eventually.eq(false)

          await etherToken.deposit({ value: 5 })
          await etherToken.approve(policy.address, 5)
          await policy.payTranchPremium(0).should.be.fulfilled

          await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(0)
          await policy.getNextTranchPremiumAmount(0).should.eventually.eq(3)
          await policy.tranchPaymentsAllMade(0).should.eventually.eq(false)
        })
      })

      describe('once policy has been active for a while', () => {
        beforeEach(async () => {
          await setupPolicy({ initiationDateDiff: -100, startDateDiff: 0, maturationDateDiff: 2000, premiumIntervalSeconds: 10 })

          await createTranch(policy, {
            premiums: [2, 3, 4, 5]
          }, { from: policyOwnerAddress })
        })

        it('it will return 0 if no more payments are to be made', async () => {
          await etherToken.deposit({ value: 100 })
          await etherToken.approve(policy.address, 100)
          await policy.payTranchPremium(0).should.be.fulfilled // 2
          await policy.payTranchPremium(0).should.be.fulfilled // 3
          await policy.payTranchPremium(0).should.be.fulfilled // 4
          await policy.payTranchPremium(0).should.be.fulfilled // 5

          await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(0)
          await policy.getNextTranchPremiumAmount(0).should.eventually.eq(0)
          await policy.tranchPaymentsAllMade(0).should.eventually.eq(true)
        })

        it('it will not accept extra payments', async () => {
          await etherToken.deposit({ value: 100 })
          await etherToken.approve(policy.address, 100)
          await policy.payTranchPremium(0).should.be.fulfilled // 2
          await policy.payTranchPremium(0).should.be.fulfilled // 3
          await policy.payTranchPremium(0).should.be.fulfilled // 4
          await policy.payTranchPremium(0).should.be.fulfilled // 5

          await policy.payTranchPremium(0).should.be.rejectedWith('all payments already made')
        })
      })

      it('if one of the premiums is 0 it still counts', async () => {
        await setupPolicy({ initiationDateDiff: -100, startDateDiff: 0, maturationDateDiff: 2000, premiumIntervalSeconds: 10 })

        await createTranch(policy, {
          premiums: [2, 3, 0, 5]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)
        await policy.payTranchPremium(0).should.be.fulfilled // 2
        await policy.payTranchPremium(0).should.be.fulfilled // 3
        await policy.payTranchPremium(0).should.be.fulfilled // 0
        await policy.payTranchPremium(0).should.be.fulfilled // 5

        await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(0)
        await policy.getNextTranchPremiumAmount(0).should.eventually.eq(0)
        await policy.tranchPaymentsAllMade(0).should.eventually.eq(true)
      })

      it('if all premiums are paid before inititiation that is ok', async () => {
        await setupPolicy({ initiationDateDiff: 200, startDateDiff: 400, maturationDateDiff: 6000, premiumIntervalSeconds: 10 })

        await createTranch(policy, {
          premiums: [2, 3, 0, 5]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)
        await policy.payTranchPremium(0).should.be.fulfilled // 2
        await policy.payTranchPremium(0).should.be.fulfilled // 3
        await policy.payTranchPremium(0).should.be.fulfilled // 0
        await policy.payTranchPremium(0).should.be.fulfilled // 5

        await policy.getNumberOfTranchPaymentsMissed(0).should.eventually.eq(0)
        await policy.getNextTranchPremiumAmount(0).should.eventually.eq(0)
        await policy.tranchPaymentsAllMade(0).should.eventually.eq(true)
      })
    })
  })
})

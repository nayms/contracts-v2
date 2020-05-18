import { keccak256, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
  createPolicy,
  EvmClock,
} from './utils'
import { events } from '../'

import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'

import { ensureAclIsDeployed } from '../migrations/modules/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IERC20 = artifacts.require("./base/IERC20")
const IEntityImpl = artifacts.require('./base/IEntityImpl')
const EntityImpl = artifacts.require('./EntityImpl')
const Entity = artifacts.require('./Entity')
const PolicyFacetBase = artifacts.require("./base/PolicyFacetBase")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./base/IPolicy")
const TestPolicyImpl = artifacts.require("./test/TestPolicyImpl")

contract('Policy', accounts => {
  let acl
  let systemContext
  let settings
  let entityDeployer
  let entityImpl
  let entityProxy
  let entity
  let entityContext
  let policyCore
  let policyProxy
  let policy
  let policyContext
  let entityManagerAddress
  let policyOwnerAddress
  let market
  let etherToken

  let POLICY_STATE_CREATED
  let POLICY_STATE_SELLING
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED

  let TRANCH_STATE_CANCELLED
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED

  let setupPolicy

  beforeEach(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts }, acl.address)

    // market
    market = await ensureMarketIsDeployed({ artifacts }, settings.address)

    // registry + wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts }, acl.address, settings.address)

    // entity
    entityImpl = await EntityImpl.new(acl.address, settings.address)
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts }, acl.address, settings.address, entityImpl.address)

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

    const [ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts }, acl.address, settings.address)

    const policyFacetBase = await PolicyFacetBase.at(policyCoreAddress)

    POLICY_STATE_CREATED = await policyFacetBase.POLICY_STATE_CREATED()
    POLICY_STATE_SELLING = await policyFacetBase.POLICY_STATE_SELLING()
    POLICY_STATE_ACTIVE = await policyFacetBase.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyFacetBase.POLICY_STATE_MATURED()
    TRANCH_STATE_CANCELLED = await policyFacetBase.TRANCH_STATE_CANCELLED()
    TRANCH_STATE_ACTIVE = await policyFacetBase.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyFacetBase.TRANCH_STATE_MATURED()

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

      const attrs = {
        initiationDate: currentBlockTime + initiationDateDiff,
        startDate: currentBlockTime + startDateDiff,
        maturationDate: currentBlockTime + maturationDateDiff,
        unit: etherToken.address,
        premiumIntervalSeconds,
        brokerCommissionBP,
        assetManagerCommissionBP,
        naymsCommissionBP,
      }

      const createPolicyTx = await createPolicy(entity, attrs, { from: entityManagerAddress })
      const policyAddress = extractEventArgs(createPolicyTx, events.NewPolicy).policy

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicy.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress

      return attrs
    }
  })

  describe('basic tests', () => {
    beforeEach(async () => {
      await setupPolicy()
    })

    it.only('can be deployed', async () => {
      expect(policyProxy.address).to.exist
    })

    it('can return its implementation version', async () => {
      await policyCore.getImplementationVersion().should.eventually.eq('v1')
    })

    it('can return its basic info', async () => {
      const attrs = await setupPolicy({
        premiumIntervalSeconds: 5,
        assetManagerCommissionBP: 1,
        brokerCommissionBP: 2,
        naymsCommissionBP: 3,
      })

      await policy.getInfo().should.eventually.matchObj({
        initiationDate_: attrs.initiationDate,
        startDate_: attrs.startDate,
        maturationDate_: attrs.maturationDate,
        unit_: attrs.unit,
        premiumIntervalSeconds_: 5,
        assetManagerCommissionBP_: 1,
        brokerCommissionBP_: 2,
        naymsCommissionBP_: 3,
        numTranches_: 0,
        state_: POLICY_STATE_CREATED
      })
    })
  })

  describe('it can be upgraded', async () => {
    let policyCore2
    let randomSig
    let assetMgrSig
    let clientMgrSig

    beforeEach(async () => {
      await setupPolicy()

      // assign roles
      await acl.assignRole(policyContext, accounts[3], ROLES.ASSET_MANAGER)
      await acl.assignRole(policyContext, accounts[4], ROLES.CLIENT_MANAGER)

      // deploy new implementation
      policyCore2 = await TestPolicyImpl.new()

      // generate upgrade approval signatures
      const implVersion = await policyCore2.getImplementationVersion()
      randomSig = hdWallet.sign({ address: accounts[5], data: keccak256(implVersion) })
      assetMgrSig = hdWallet.sign({ address: accounts[3], data: keccak256(implVersion) })
      clientMgrSig = hdWallet.sign({ address: accounts[4], data: keccak256(implVersion) })
    })

    it('but not just by anyone', async () => {
      await policyProxy.upgrade(policyCore2.address, assetMgrSig, clientMgrSig, { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('but must have asset manager\'s approval', async () => {
      await policyProxy.upgrade(policyCore2.address, randomSig, clientMgrSig).should.be.rejectedWith('must be approved by asset manager')
    })

    it('but must have client manager\'s approval', async () => {
      await policyProxy.upgrade(policyCore2.address, assetMgrSig, randomSig).should.be.rejectedWith('must be approved by client manager')
    })

    it('but not to an empty address', async () => {
      await policyProxy.upgrade(ADDRESS_ZERO, assetMgrSig, clientMgrSig).should.be.rejectedWith('implementation must be valid')
    })

    it('but not if signatures are empty', async () => {
      await policyProxy.upgrade(policyCore2.address, "0x0", "0x0").should.be.rejectedWith('valid signer not found')
    })

    it('but not to the existing implementation', async () => {
      const vExisting = await policyCore.getImplementationVersion()
      assetMgrSig = hdWallet.sign({ address: accounts[3], data: keccak256(vExisting) })
      clientMgrSig = hdWallet.sign({ address: accounts[4], data: keccak256(vExisting) })
      await policyProxy.upgrade(policyCore.address, assetMgrSig, clientMgrSig).should.be.rejectedWith('already this implementation')
    })

    it('and points to the new implementation', async () => {
      const result = await policyProxy.upgrade(policyCore2.address, assetMgrSig, clientMgrSig).should.be.fulfilled

      expect(extractEventArgs(result, events.Upgraded)).to.include({
        implementation: policyCore2.address,
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

      describe('a valid number of premiums must be provided', () => {
        beforeEach(async () => {
          // allow upto 4 premiums
          await setupPolicy({ initiationDateDiff: 0, startDateDiff: 0, maturationDateDiff: 30, premiumIntervalSeconds: 10 })
        })

        it('0', async () => {
          await createTranch(policy, { premiums: [] }, { from: policyOwnerAddress }).should.be.fulfilled
        })

        it('less than max', async () => {
          await createTranch(policy, { premiums: [1] }, { from: policyOwnerAddress }).should.be.fulfilled
        })

        it('max', async () => {
          await createTranch(policy, { premiums: [1, 2, 3, 4] }, { from: policyOwnerAddress }).should.be.fulfilled
        })

        it('above max', async () => {
          await createTranch(policy, { premiums: [1, 2, 3, 4, 5] }, { from: policyOwnerAddress }).should.be.rejectedWith('too many premiums')
        })

        it('above max but filtering out 0-values results in max', async () => {
          await createTranch(policy, { premiums: [0, 0, 0, 1, 2, 0, 3, 4] }, { from: policyOwnerAddress }).should.be.fulfilled
        })
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

        const { token_: addr } = await policy.getTranchInfo(0)
        expect(addr.length).to.eq(42)

        expect(log.args.token).to.eq(addr)
        expect(log.args.initialBalanceHolder).to.eq(policy.address)
        expect(log.args.index).to.eq('0')

        await policy.getInfo().should.eventually.matchObj({ numTranches: 1 })
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

        await policy.getTranchInfo(0).should.eventually.matchObj({
          state_: POLICY_STATE_CREATED
        })
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

        await policy.getInfo().should.eventually.matchObj({ numTranches_: 2 })

        const addresses = {}

        await Promise.all(_.range(0, 2).map(async i => {
          const { token_: addr } = await policy.getTranchInfo(i)
          expect(!addresses[addr]).to.be.true
          expect(addr.length).to.eq(42)
          addresses[addr] = true
        }))

        expect(Object.keys(addresses).length).to.eq(2)
      })

      it('cannot be created once already in selling state', async () => {
        await setupPolicy({ initiationDateDiff: 0 })
        await policy.checkAndUpdateState() // kick-off sale
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING })
        await createTranch(policy, {}, { from: accounts[2] }).should.be.rejectedWith('must be in created state')
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
          const tkn = await IERC20.at((await policy.getTranchInfo(i)).token_)

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
          const tkn = await IERC20.at((await policy.getTranchInfo(i)).token_)

          await tkn.balanceOf(accounts[0]).should.eventually.eq(await tkn.totalSupply())

          done++
        }))

        expect(done).to.eq(2)
      })

      describe('which support operations', () => {
        let firstTkn
        let firstTknNumShares

        beforeEach(async () => {
          firstTkn = await IERC20.at((await policy.getTranchInfo(0)).token_)
          firstTknNumShares = await firstTkn.totalSupply()
        })

        it('but sending one\'s own tokens is not possible', async () => {
          await firstTkn.transfer(accounts[0], firstTknNumShares).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('but approving an address to send on one\'s behalf is not possible', async () => {
          await firstTkn.approve(accounts[1], 2).should.be.rejectedWith('only nayms market is allowed to transfer')
        })

        it('approving an address to send on one\'s behalf is possible if it is the market', async () => {
          await settings.setAddress(settings.address, SETTINGS.MARKET, accounts[3]).should.be.fulfilled
          await firstTkn.approve(accounts[3], 2).should.be.fulfilled
        })

        describe('such as market sending tokens on one\' behalf', () => {
          beforeEach(async () => {
            await settings.setAddress(settings.address, SETTINGS.MARKET, accounts[3]).should.be.fulfilled
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
        let policyAttrs

        beforeEach(async () => {
          policyAttrs = await setupPolicy()
        })

        it('empty premiums array is allowed', async () => {
          await createTranch(policy, {
            premiums: []
          }, { from: policyOwnerAddress })

          await policy.getTranchInfo(0).should.eventually.matchObj({
            numPremiums_: 0,
            nextPremiumAmount_: 0,
            nextPremiumDueAt_: 0,
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 0,
          })
        })

        it('initially the first premium is expected by the inititation date', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await policy.getTranchInfo(0).should.eventually.matchObj({
            numPremiums_: 3,
            nextPremiumAmount_: 2,
            nextPremiumDueAt_: policyAttrs.initiationDate,
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 0,
          })
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

        it('emits an event upon payment', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await etherToken.deposit({ value: 2 })
          await etherToken.approve(policy.address, 2)
          const ret = await policy.payTranchPremium(0)

          expect(extractEventArgs(ret, events.PremiumPayment)).to.include({
            tranchIndex: '0',
            amount: '2',
          })
        })

        it('updates the internal stats once first payment is made', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await etherToken.deposit({ value: 2 })
          await etherToken.approve(policy.address, 2)
          await policy.payTranchPremium(0).should.be.fulfilled

          await policy.getTranchInfo(0).should.eventually.matchObj({
            nextPremiumAmount_: 3,
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 1,
            balance_: 2,
          })

          await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
            amount_: 2,
            dueAt_: policyAttrs.initiationDate,
            paidBy_: accounts[0]
          })
        })

        it('updates the internal stats once subsequent payment is made', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })

          await etherToken.deposit({ value: 5 })
          await etherToken.approve(policy.address, 5)
          await policy.payTranchPremium(0).should.be.fulfilled
          await policy.payTranchPremium(0).should.be.fulfilled

          await policy.getTranchInfo(0).should.eventually.matchObj({
            nextPremiumAmount_: 4,
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 2,
            balance_: 5,
          })

          await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
            amount_: 3,
            dueAt_: policyAttrs.initiationDate + 30,
            paidBy_: accounts[0]
          })
        })
      })

      describe('0-values', () => {
        let policyAttrs

        beforeEach(async () => {
          policyAttrs = await setupPolicy()
        })

        it('0-values are skipped over when it comes to the first payment', async () => {
          await createTranch(policy, {
            premiums: [0, 0, 0, 2, 3, 4]
          }, { from: policyOwnerAddress })

          await policy.getTranchInfo(0).should.eventually.matchObj({
            numPremiums_: 3,
            nextPremiumAmount_: 2,
            nextPremiumDueAt_: policyAttrs.initiationDate + (30 * 3),
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 0,
          })

          await etherToken.deposit({ value: 2 })
          await etherToken.approve(policy.address, 2)
          await policy.payTranchPremium(0)

          await policy.getTranchInfo(0).should.eventually.matchObj({
            nextPremiumAmount_: 3,
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 1,
            balance_: 2,
          })
        })

        it('0-values are skipped over for subsequent payments too', async () => {
          await createTranch(policy, {
            premiums: [2, 3, 0, 4, 0, 0, 5, 0]
          }, { from: policyOwnerAddress })

          await policy.getTranchInfo(0).should.eventually.matchObj({
            numPremiums_: 4,
            nextPremiumAmount_: 2,
            nextPremiumDueAt_: policyAttrs.initiationDate,
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 0,
          })

          await policy.getTranchPremiumInfo(0, 0).should.eventually.matchObj({
            amont_: 2,
            dueAt_: policyAttrs.initiationDate,
            paidAt_: 0,
            paidBy_: ADDRESS_ZERO,
          })

          await policy.getTranchPremiumInfo(0, 1).should.eventually.matchObj({
            amont_: 3,
            dueAt_: policyAttrs.initiationDate + 30,
            paidAt_: 0,
            paidBy_: ADDRESS_ZERO,
          })

          await policy.getTranchPremiumInfo(0, 2).should.eventually.matchObj({
            amont_: 4,
            dueAt_: policyAttrs.initiationDate + (30 * 3),
            paidAt_: 0,
            paidBy_: ADDRESS_ZERO,
          })

          await policy.getTranchPremiumInfo(0, 3).should.eventually.matchObj({
            amont_: 5,
            dueAt_: policyAttrs.initiationDate + (30 * 6),
            paidAt_: 0,
            paidBy_: ADDRESS_ZERO,
          })

          // pay them all
          await etherToken.deposit({ value: 40 })
          await etherToken.approve(policy.address, 40)
          await policy.payTranchPremium(0)
          await policy.payTranchPremium(0)
          await policy.payTranchPremium(0)
          await policy.payTranchPremium(0)

          await policy.getTranchInfo(0).should.eventually.matchObj({
            numPremiums_: 4,
            nextPremiumAmount_: 0,
            nextPremiumDueAt_: 0,
            premiumPaymentsMissed_: 0,
            numPremiumsPaid_: 4,
          })
        })
      })

      describe('before initiation date has passed', () => {
        let policyAttrs

        beforeEach(async () => {
          policyAttrs = await setupPolicy({ initiationDateDiff: 0, startDateDiff: 2000, maturationDateDiff: 3000 })

          await createTranch(policy, {
            premiums: [2, 3, 4]
          }, { from: policyOwnerAddress })
        })

        it('it requires first payment to have been made', async () => {
          await policy.getTranchInfo(0).should.eventually.matchObj({
            premiumPaymentsMissed_: 1,
            nextPremiumAmount_: 2,
            numPremiumsPaid_: 0,
          })

          await etherToken.deposit({ value: 5 })
          await etherToken.approve(policy.address, 5)
          await policy.payTranchPremium(0).should.be.rejectedWith('payment too late')
        })
      })

      it('if all premiums are paid before initiation that is ok', async () => {
        await setupPolicy({ initiationDateDiff: 200, startDateDiff: 400, maturationDateDiff: 6000, premiumIntervalSeconds: 10 })

        await createTranch(policy, {
          premiums: [2, 3, 5]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)
        await policy.payTranchPremium(0).should.be.fulfilled // 2
        await policy.payTranchPremium(0).should.be.fulfilled // 3
        await policy.payTranchPremium(0).should.be.fulfilled // 5

        await policy.getTranchInfo(0).should.eventually.matchObj({
          premiumPaymentsMissed_: 0,
          nextPremiumAmount_: 0,
          nextPremiumDueAt_: 0,
          numPremiumsPaid_: 3,
        })
      })

      it('will not accept extra payments', async () => {
        await setupPolicy({ initiationDateDiff: 100, startDateDiff: 200, maturationDateDiff: 2000, premiumIntervalSeconds: 10 })

        await createTranch(policy, {
          premiums: [2, 3, 4, 5]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)
        await policy.payTranchPremium(0).should.be.fulfilled // 2
        await policy.payTranchPremium(0).should.be.fulfilled // 3
        await policy.payTranchPremium(0).should.be.fulfilled // 4
        await policy.payTranchPremium(0).should.be.fulfilled // 5

        await policy.payTranchPremium(0).should.be.rejectedWith('all payments already made')
      })
    })

    describe('disallowed', () => {
      let evmClock

      beforeEach(async () => {
        evmClock = new EvmClock()

        await setupPolicy({
          initiationDateDiff: 10,
          startDateDiff: 30,
          maturationDateDiff: 60,
          premiumIntervalSeconds: 50
        })

        await createTranch(policy, {
          premiums: [2, 3]
        }, { from: policyOwnerAddress })

        await etherToken.deposit({ value: 100 })
        await etherToken.approve(policy.address, 100)

        // pay first premium
        await policy.payTranchPremium(0).should.be.fulfilled

        // kick-off sale
        await evmClock.setTime(10)
        await policy.checkAndUpdateState()
      })

      it('if tranch is already cancelled', async () => {
        // shift to start date
        await evmClock.setTime(30)
        // should auto-call heartbeat in here
        await policy.payTranchPremium(0).should.be.rejectedWith('payment not allowed')

        await policy.getTranchInfo(0).should.eventually.matchObj({
          _state: TRANCH_STATE_CANCELLED,
        })
      })

      it('if tranch has already matured', async () => {
        // pay second premium
        await policy.payTranchPremium(0).should.be.fulfilled

        // shift to maturation date
        await evmClock.setTime(60)

        // should auto-call heartbeat in here
        await policy.payTranchPremium(0).should.be.rejectedWith('payment not allowed')

        await policy.getTranchInfo(0).should.eventually.matchObj({
          _state: TRANCH_STATE_MATURED,
        })
      })
    })

    describe('commissions', () => {
      beforeEach(async () => {
        await setupPolicy({
          brokerCommissionBP: 2,
          assetManagerCommissionBP: 1,
          naymsCommissionBP: 3,
        })

        await createTranch(policy, {
          premiums: [2000, 3000, 4000]
        }, { from: policyOwnerAddress })
      })

      it('updates the balances correctly as premiums get paid in', async () => {
        await etherToken.deposit({ value: 10000 })
        await etherToken.approve(policy.address, 10000)

        await policy.payTranchPremium(0)

        await policy.getCommissionBalances().should.eventually.matchObj({
          assetManagerCommissionBalance_: 2, /* 0.1% of 2000 */
          brokerCommissionBalance_: 4, /* 0.2% of 2000 */
          naymsCommissionBalance_: 6, /* 0.3% of 2000 */
        })

        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 1988, /* 2000 - (2 + 4 + 6) */
        })

        await policy.payTranchPremium(0)

        await policy.getCommissionBalances().should.eventually.matchObj({
          assetManagerCommissionBalance_: 5, /* 2 + 3 (=0.1% of 3000) */
          brokerCommissionBalance_: 10, /* 4 + 6 (=0.2% of 3000) */
          naymsCommissionBalance_: 15, /* 6 + 9 (=0.3% of 3000) */
        })
        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 4970, /* 1988 + 3000 - (3 + 6 + 9) */
        })

        await policy.payTranchPremium(0)

        await policy.getCommissionBalances().should.eventually.matchObj({
          assetManagerCommissionBalance_: 9, /* 5 + 4 (=0.1% of 4000) */
          brokerCommissionBalance_: 18, /* 10 + 8 (=0.2% of 4000) */
          naymsCommissionBalance_: 27, /* 15 + 12 (=0.3% of 4000) */
        })
        await policy.getTranchInfo(0).should.eventually.matchObj({
          balance_: 8946, /* 4970 + 4000 - (4 + 8 + 12) */
        })
      })

      describe('and the commissions can be paid out', async () => {
        beforeEach(async () => {
          await etherToken.deposit({ value: 10000 })
          await etherToken.approve(policy.address, 10000)

          await policy.payTranchPremium(0)
          await policy.payTranchPremium(0)

          // assign roles
          await acl.assignRole(policyContext, accounts[5], ROLES.ASSET_MANAGER)
          await acl.assignRole(policyContext, accounts[6], ROLES.BROKER)

          // assign to entities
          await acl.assignRole(entityContext, accounts[5], ROLES.ENTITY_REP)
          await acl.assignRole(entityContext, accounts[6], ROLES.ENTITY_REP)
        })

        it('but not if invalid asset manager entity gets passed in', async () => {
          await policy.payCommissions(accounts[1], accounts[5], entity.address, accounts[6]).should.be.rejectedWith('revert')
        })

        it('but not if invalid broker entity gets passed in', async () => {
          await policy.payCommissions(entity.address, accounts[5], accounts[1], accounts[6]).should.be.rejectedWith('revert')
        })

        it('but not if invalid asset manager gets passed in', async () => {
          await policy.payCommissions(entity.address, accounts[7], entity.address, accounts[6]).should.be.rejectedWith('must be asset manager')
        })

        it('but not if invalid broker gets passed in', async () => {
          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[7]).should.be.rejectedWith('must be broker')
        })

        it('but not if asset manager does not belong to entity', async () => {
          await acl.unassignRole(entityContext, accounts[5], ROLES.ENTITY_REP)
          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6]).should.be.rejectedWith('must have role in asset manager entity')
        })

        it('but not if broker does not belong to entity', async () => {
          await acl.unassignRole(entityContext, accounts[6], ROLES.ENTITY_REP)
          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6]).should.be.rejectedWith('must have role in broker entity')
        })

        it('and emits an event', async () => {
          const ret = await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

          expect(extractEventArgs(ret, events.PaidCommissions)).to.include({
            assetManagerEntity: entity.address,
            brokerEntity: entity.address
          })
        })

        it('and gets transferred', async () => {
          const preBalance = (await etherToken.balanceOf(entity.address)).toNumber()

          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

          const postBalance = (await etherToken.balanceOf(entity.address)).toNumber()

          expect(postBalance - preBalance).to.eq(5 + 10)

          const naymsEntityAddress = await settings.getRootAddress(SETTINGS.NAYMS_ENTITY)
          const naymsEntityBalance = (await etherToken.balanceOf(naymsEntityAddress)).toNumber()

          expect(naymsEntityBalance).to.eq(15)
        })

        it('and updates internal balance values', async () => {
          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])
          await policy.getCommissionBalances().should.eventually.matchObj({
            assetManagerCommissionBalance_: 0,
            brokerCommissionBalance_: 0,
            naymsCommissionBalance_: 0,
          })
        })

        it('and allows multiple calls', async () => {
          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])
          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

          await policy.payTranchPremium(0)

          await policy.payCommissions(entity.address, accounts[5], entity.address, accounts[6])

          const naymsEntityAddress = await settings.getRootAddress(SETTINGS.NAYMS_ENTITY)
          const naymsEntityBalance = (await etherToken.balanceOf(naymsEntityAddress)).toNumber()
          expect(naymsEntityBalance).to.eq(27)

          await policy.getCommissionBalances().should.eventually.matchObj({
            assetManagerCommissionBalance_: 0,
            brokerCommissionBalance_: 0,
            naymsCommissionBalance_: 0,
          })
        })
      })
    })

    describe('claims', () => {
      let evmClock
      let setupPolicyForClaims

      let buyAllTranchTokens

      beforeEach(async () => {
        setupPolicyForClaims = async (attrs = {}) => {
          attrs.premiumIntervalSeconds = 10
          await setupPolicy(attrs)

          await createTranch(policy, {
            premiums: [2000, 3000, 4000]
          }, { from: policyOwnerAddress })

          await createTranch(policy, {
            premiums: [7000, 1000, 5000]
          }, { from: policyOwnerAddress })

          await createTranch(policy, {  // this tranch will be cancelled because we won't pay all the premiums
            premiums: [7000, 1000, 5000]
          }, { from: policyOwnerAddress })

          await createTranch(policy, {  // this tranch will be cancelled because we won't pay all the premiums
            premiums: [7000, 1000, 5000]
          }, { from: policyOwnerAddress })

          const { token_: tranch0Address } = await policy.getTranchInfo(0)
          const { token_: tranch1Address } = await policy.getTranchInfo(1)
          const { token_: tranch2Address } = await policy.getTranchInfo(2)
          const { token_: tranch3Address } = await policy.getTranchInfo(3)

          // now pay premiums
          await etherToken.deposit({ value: 50000 })
          await etherToken.approve(policy.address, 50000)

          // pay all
          await policy.payTranchPremium(0)
          await policy.payTranchPremium(0)
          await policy.payTranchPremium(0)

          // pay all
          await policy.payTranchPremium(1)
          await policy.payTranchPremium(1)
          await policy.payTranchPremium(1)

          // pay 1 (so it's cancelled by the start date time)
          await policy.payTranchPremium(2)

          // pay 2 (so it's active by the start date time but should be cancelled after that)
          await policy.payTranchPremium(3)
          await policy.payTranchPremium(3)

          evmClock = new EvmClock()

          buyAllTranchTokens = async () => {
            await etherToken.deposit({ value: 40 })
            await etherToken.approve(market.address, 40)
            await market.offer(10, etherToken.address, 10, tranch0Address, 0, false)
            await market.offer(10, etherToken.address, 10, tranch1Address, 0, false)
            await market.offer(10, etherToken.address, 10, tranch2Address, 0, false)
            await market.offer(10, etherToken.address, 10, tranch3Address, 0, false)
          }
        }
      })

      it('cannot be made in created state', async () => {
        await setupPolicyForClaims()
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_CREATED })
        await policy.makeClaim(0, entity.address, 1).should.be.rejectedWith('must be in active state')
      })

      it('cannot be made in selling state', async () => {
        await setupPolicyForClaims({ initiationDateDiff: 10, startDateDiff: 100 })
        await evmClock.setTime(10)
        await policy.checkAndUpdateState()
        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_SELLING })
        await policy.makeClaim(0, entity.address, 1).should.be.rejectedWith('must be in active state')
      })

      it('can be made in active state', async () => {
        await setupPolicyForClaims({ initiationDateDiff: 10, startDateDiff: 100 })

        await evmClock.setTime(10)
        await policy.checkAndUpdateState()
        await evmClock.setTime(100)
        await buyAllTranchTokens()
        await policy.checkAndUpdateState()

        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })
        await policy.getTranchInfo(0).should.eventually.matchObj({
          state_: TRANCH_STATE_ACTIVE
        })

        await acl.assignRole(policyContext, accounts[5], ROLES.CLIENT_MANAGER);
        const clientManagerAddress = accounts[5]
        await acl.assignRole(entityContext, clientManagerAddress, ROLES.ENTITY_REP)

        await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
      })

      it('cannot be made in matured state', async () => {
        await setupPolicyForClaims({ initiationDateDiff: 10, startDateDiff: 200, maturationDateDiff: 200 })

        await evmClock.setTime(10)
        await policy.checkAndUpdateState()
        await buyAllTranchTokens()
        await evmClock.setTime(200)
        await policy.checkAndUpdateState()

        await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_MATURED })
        await policy.getTranchInfo(0).should.eventually.matchObj({
          state_: TRANCH_STATE_MATURED
        })

        await acl.assignRole(policyContext, accounts[5], ROLES.CLIENT_MANAGER);
        const clientManagerAddress = accounts[5]
        await acl.assignRole(entityContext, clientManagerAddress, ROLES.ENTITY_REP)

        await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('must be in active state')
      })

      describe('when in active state', () => {
        let clientManagerAddress

        beforeEach(async () => {
          await setupPolicyForClaims({ initiationDateDiff: 10, startDateDiff: 20 })
          await evmClock.setTime(10)
          await policy.checkAndUpdateState()
          await evmClock.setTime(20) // expect 2 premium payments to have been paid for every tranch by this point
          await buyAllTranchTokens()
          await policy.checkAndUpdateState()
          await policy.getInfo().should.eventually.matchObj({ state_: POLICY_STATE_ACTIVE })

          await acl.assignRole(policyContext, accounts[5], ROLES.CLIENT_MANAGER);
          clientManagerAddress = accounts[5]
        })

        it('must be made by client managers', async () => {
          await policy.makeClaim(0, accounts[1], 1).should.be.rejectedWith('must be client manager')
        })

        it('must be supplied valid client manager entity', async () => {
          await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('must have role in client manager entity')
        })

        describe('if valid client manager and entity provided', () => {
          beforeEach(async () => {
            await acl.assignRole(entityContext, clientManagerAddress, ROLES.ENTITY_REP)
          })

          it('claim must be against an active tranch (and it will call the heartbeat first to check)', async () => {
            await policy.getTranchInfo(3).should.eventually.matchObj({
              state_: TRANCH_STATE_ACTIVE
            })

            // past next premium payment interval
            await evmClock.setTime(40)

            await policy.makeClaim(3, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('tranch must be active');
          })

          it('claim must be against an active tranch', async () => {
            await policy.getTranchInfo(2).should.eventually.matchObj({
              state_: TRANCH_STATE_CANCELLED
            })
            await policy.makeClaim(2, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('tranch must be active');
          })

          it('claim must be less than available balance', async () => {
            const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

            await policy.makeClaim(0, entity.address, tranchBalance + 1, { from: clientManagerAddress }).should.be.rejectedWith('claim too high')
            await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.fulfilled
          })

          it('claim must be less than available balance, taking into account existing pending claims', async () => {
            const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

            await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.fulfilled
            await policy.makeClaim(0, entity.address, 1, { from: clientManagerAddress }).should.be.rejectedWith('claim too high')
            await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
          })

          it('emits an event', async () => {
            const ret = await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress })

            expect(extractEventArgs(ret, events.NewClaim)).to.include({
              tranchIndex: '0',
              claimIndex: '0'
            })
          })

          it('claim updates internal stats', async () => {
            await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress }).should.be.fulfilled
            await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
            await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress }).should.be.fulfilled

            await policy.getClaimStats().should.eventually.matchObj({
              numClaims_: 3,
              numPendingClaims_: 3,
            })

            await policy.getClaimInfo(0).should.eventually.matchObj({
              amount_: 4,
              tranchIndex_: 0,
              approved_: false,
              declined_: false,
              paid_: false,
            })

            await policy.getClaimInfo(1).should.eventually.matchObj({
              amount_: 1,
              tranchIndex_: 1,
              approved_: false,
              declined_: false,
              paid_: false,
            })

            await policy.getClaimInfo(2).should.eventually.matchObj({
              amount_: 5,
              tranchIndex_: 1,
              approved_: false,
              declined_: false,
              paid_: false,
            })
          })

          describe('and claims can be declined', async () => {
            let assetManagerAddress

            beforeEach(async () => {
              await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress }).should.be.fulfilled
              await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
              await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress }).should.be.fulfilled

              await acl.assignRole(policyContext, accounts[9], ROLES.ASSET_MANAGER)
              assetManagerAddress = accounts[9]
            })

            it('but not if not an asset manager', async () => {
              await policy.declineClaim(0).should.be.rejectedWith('must be asset manager')
            })

            it('but not if claim is invalid', async () => {
              await policy.declineClaim(5, { from: assetManagerAddress }).should.be.rejectedWith('invalid claim')
            })

            it('cannot decline twice', async () => {
              await policy.declineClaim(0, { from: assetManagerAddress }).should.be.fulfilled
              await policy.declineClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already declined')
            })

            it('cannot decline if alrady approved', async () => {
              await policy.approveClaim(0, { from: assetManagerAddress }).should.be.fulfilled
              await policy.declineClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already approved')
            })

            it('and no longer counts towards pending balance', async () => {
              const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

              await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.rejectedWith('claim too high')
              await policy.declineClaim(0, { from: assetManagerAddress })
              await policy.makeClaim(0, entity.address, tranchBalance, { from: clientManagerAddress }).should.be.fulfilled
            })

            it('emits an event', async () => {
              const ret = await policy.declineClaim(0, { from: assetManagerAddress })

              expect(extractEventArgs(ret, events.ClaimDeclined)).to.include({
                claimIndex: '0'
              })
            })

            it('updates internal stats', async () => {
              await policy.declineClaim(0, { from: assetManagerAddress }).should.be.fulfilled

              await policy.getClaimStats().should.eventually.matchObj({
                numClaims_: 3,
                numPendingClaims_: 2,
              })

              await policy.getClaimInfo(0).should.eventually.matchObj({
                approved_: false,
                declined_: true,
                paid_: false,
              })

              await policy.getClaimInfo(1).should.eventually.matchObj({
                approved_: false,
                declined_: false,
                paid_: false,
              })

              await policy.getClaimInfo(2).should.eventually.matchObj({
                approved_: false,
                declined_: false,
                paid_: false,
              })
            })

            it('leaves tranch balance unchanged', async () => {
              const tranchBalance = ((await policy.getTranchInfo(0))).balance_.toNumber()

              await policy.declineClaim(0, { from: assetManagerAddress })

              await policy.getTranchInfo(0).should.eventually.matchObj({
                balance_: tranchBalance
              })
            })
          })

          describe('and claims can be approved', async () => {
            let assetManagerAddress

            beforeEach(async () => {
              await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress }).should.be.fulfilled
              await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress }).should.be.fulfilled
              await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress }).should.be.fulfilled

              await acl.assignRole(policyContext, accounts[9], ROLES.ASSET_MANAGER)
              assetManagerAddress = accounts[9]
            })

            it('but not if not an asset manager', async () => {
              await policy.approveClaim(0).should.be.rejectedWith('must be asset manager')
            })

            it('but not if claim is invalid', async () => {
              await policy.approveClaim(5, { from: assetManagerAddress }).should.be.rejectedWith('invalid claim')
            })

            it('cannot approve twice', async () => {
              await policy.approveClaim(0, { from: assetManagerAddress }).should.be.fulfilled
              await policy.approveClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already approved')
            })

            it('cannot approve if alrady declined', async () => {
              await policy.declineClaim(0, { from: assetManagerAddress }).should.be.fulfilled
              await policy.approveClaim(0, { from: assetManagerAddress }).should.be.rejectedWith('already declined')
            })

            it('emits an event', async () => {
              const ret = await policy.approveClaim(0, { from: assetManagerAddress })

              expect(extractEventArgs(ret, events.ClaimApproved)).to.include({
                claimIndex: '0'
              })
            })

            it('updates internal stats', async () => {
              await policy.approveClaim(0, { from: assetManagerAddress }).should.be.fulfilled

              await policy.getClaimStats().should.eventually.matchObj({
                numClaims_: 3,
                numPendingClaims_: 2,
              })

              await policy.getClaimInfo(0).should.eventually.matchObj({
                approved_: true,
                declined_: false,
                paid_: false,
              })

              await policy.getClaimInfo(1).should.eventually.matchObj({
                approved_: false,
                declined_: false,
                paid_: false,
              })

              await policy.getClaimInfo(2).should.eventually.matchObj({
                approved_: false,
                declined_: false,
                paid_: false,
              })
            })

            it('updates tranch balance', async () => {
              const tranchBalance = (await policy.getTranchInfo(0)).balance_.toNumber()

              await policy.approveClaim(0, { from: assetManagerAddress })

              await policy.getTranchInfo(0).should.eventually.matchObj({
                balance_: tranchBalance - 4
              })
            })
          })

          describe('and claims can be paid out once approved and/or declined', async () => {
            beforeEach(async () => {
              await policy.makeClaim(0, entity.address, 4, { from: clientManagerAddress })
              await policy.makeClaim(0, entity.address, 2, { from: clientManagerAddress })
              await policy.makeClaim(1, entity.address, 1, { from: clientManagerAddress })
              await policy.makeClaim(1, entity.address, 5, { from: clientManagerAddress })

              await acl.assignRole(policyContext, accounts[9], ROLES.ASSET_MANAGER)
              const assetManagerAddress = accounts[9]

              await policy.approveClaim(0, { from: assetManagerAddress })
              await policy.declineClaim(1, { from: assetManagerAddress })
              await policy.approveClaim(2, { from: assetManagerAddress })
            })

            it('and an event gets emitted', async () => {
              const ret = await policy.payClaims()

              expect(extractEventArgs(ret, events.PaidClaims)).to.exist
            })

            it('and the payout goes to the client manager entities', async () => {
              const preBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

              await policy.payClaims()

              const postBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

              expect(postBalance - preBalance).to.eq(5)
            })

            it('and only does the payouts for a given approved claim', async () => {
              const preBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

              await policy.payClaims()
              await policy.payClaims()
              await policy.payClaims()

              const postBalance = ((await etherToken.balanceOf(entity.address))).toNumber()

              expect(postBalance - preBalance).to.eq(5)
            })

            it('and it updates the internal stats', async () => {
              await policy.payClaims()

              await policy.getClaimStats().should.eventually.matchObj({
                numClaims_: 4,
                numPendingClaims_: 1,
              })

              await policy.getClaimInfo(0).should.eventually.matchObj({
                approved_: true,
                declined_: false,
                paid_: true,
              })

              await policy.getClaimInfo(1).should.eventually.matchObj({
                approved_: false,
                declined_: true,
                paid_: false,
              })

              await policy.getClaimInfo(2).should.eventually.matchObj({
                approved_: true,
                declined_: false,
                paid_: true,
              })

              await policy.getClaimInfo(3).should.eventually.matchObj({
                approved_: false,
                declined_: false,
                paid_: false,
              })
            })
          })
        })
      })
    })
  })
})

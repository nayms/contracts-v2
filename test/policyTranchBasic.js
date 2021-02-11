
import { keccak256, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
  createTranch,
  preSetupPolicy,
  createEntity,
  EvmSnapshot,
} from './utils'
import { events } from '../'

import { ROLES, ROLEGROUPS, SETTINGS } from '../utils/constants'

import { ensureAclIsDeployed } from '../migrations/modules/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/modules/etherToken'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureEntityDeployerIsDeployed } from '../migrations/modules/entityDeployer'
import { ensureMarketIsDeployed } from '../migrations/modules/market'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ensurePolicyImplementationsAreDeployed } from '../migrations/modules/policyImplementations'

const IERC20 = artifacts.require("./base/IERC20")
const IEntity = artifacts.require('./base/IEntity')
const Entity = artifacts.require('./Entity')
const IDiamondProxy = artifacts.require('./base/IDiamondProxy')
const IPolicyStates = artifacts.require("./base/IPolicyStates")
const Policy = artifacts.require("./Policy")
const IPolicy = artifacts.require("./base/IPolicy")
const TestPolicyFacet = artifacts.require("./test/TestPolicyFacet")
const FreezeUpgradesFacet = artifacts.require("./test/FreezeUpgradesFacet")



contract('Policy Tranches: Basic', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let systemContext
  let settings
  let entityDeployer
  let entityProxy
  let entity
  let entityContext
  let policyProxy
  let policy
  let policyCoreAddress
  let policyContext
  let policyOwnerAddress
  let market
  let etherToken

  const entityAdminAddress = accounts[1]
  const entityManagerAddress = accounts[2]
  const insuredPartyRep = accounts[4]
  const underwriterRep = accounts[5]
  const brokerRep = accounts[6]
  const claimsAdminRep = accounts[7]

  let insuredParty
  let underwriter
  let broker
  let claimsAdmin
    
  let POLICY_STATE_CREATED
  let POLICY_STATE_INITIATED
  let POLICY_STATE_ACTIVE
  let POLICY_STATE_MATURED
  let POLICY_STATE_IN_APPROVAL
  let POLICY_STATE_APPROVED
  let POLICY_STATE_CANCELLED

  let TRANCH_STATE_CANCELLED
  let TRANCH_STATE_ACTIVE
  let TRANCH_STATE_MATURED

  let POLICY_ATTRS_1
  let POLICY_ATTRS_2
  let POLICY_ATTRS_3

  let setupPolicy
  const policies = new Map()

  before(async () => {
    // acl
    acl = await ensureAclIsDeployed({ artifacts })
    systemContext = await acl.systemContext()

    // settings
    settings = await ensureSettingsIsDeployed({ artifacts, acl })

    // market
    market = await ensureMarketIsDeployed({ artifacts, settings })

    // registry + wrappedEth
    etherToken = await ensureEtherTokenIsDeployed({ artifacts, settings })

    // entity
    entityDeployer = await ensureEntityDeployerIsDeployed({ artifacts, settings })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings, entityDeployer })

    await acl.assignRole(systemContext, accounts[0], ROLES.SYSTEM_MANAGER)

    const entityAddress = await createEntity(entityDeployer, entityAdminAddress)

    entityProxy = await Entity.at(entityAddress)
    entity = await IEntity.at(entityAddress)
    entityContext = await entityProxy.aclContext()

    // roles
    underwriter = await createEntity(entityDeployer, underwriterRep)
    insuredParty = await createEntity(entityDeployer, insuredPartyRep)
    broker = await createEntity(entityDeployer, brokerRep)
    claimsAdmin = await createEntity(entityDeployer, claimsAdminRep)

    POLICY_ATTRS_1 = {
      initiationDateDiff: 1000,
      startDateDiff: 2000,
      maturationDateDiff: 3000,
      premiumIntervalSeconds: undefined,
      underwriterCommissionBP: 0,
      brokerCommissionBP: 0,
      naymsCommissionBP: 0,
      underwriter, insuredParty, broker, claimsAdmin,
    }

    POLICY_ATTRS_2 = Object.assign({}, POLICY_ATTRS_1, {
      initiationDateDiff: 0,
    })

    POLICY_ATTRS_3 = Object.assign({}, POLICY_ATTRS_1, {
      initiationDateDiff: 0,
      startDateDiff: 0,
      maturationDateDiff: 30,
      premiumIntervalSeconds: 10,
    })

    // policy
    await acl.assignRole(entityContext, entityManagerAddress, ROLES.ENTITY_MANAGER)

    ;([ policyCoreAddress ] = await ensurePolicyImplementationsAreDeployed({ artifacts, settings }))

    const policyStates = await IPolicyStates.at(policyCoreAddress)
    POLICY_STATE_CREATED = await policyStates.POLICY_STATE_CREATED()
    POLICY_STATE_INITIATED = await policyStates.POLICY_STATE_INITIATED()
    POLICY_STATE_ACTIVE = await policyStates.POLICY_STATE_ACTIVE()
    POLICY_STATE_MATURED = await policyStates.POLICY_STATE_MATURED()
    POLICY_STATE_CANCELLED = await policyStates.POLICY_STATE_CANCELLED()
    POLICY_STATE_IN_APPROVAL = await policyStates.POLICY_STATE_IN_APPROVAL()
    POLICY_STATE_APPROVED = await policyStates.POLICY_STATE_APPROVED()
    
    TRANCH_STATE_CANCELLED = await policyStates.TRANCH_STATE_CANCELLED()
    TRANCH_STATE_ACTIVE = await policyStates.TRANCH_STATE_ACTIVE()
    TRANCH_STATE_MATURED = await policyStates.TRANCH_STATE_MATURED()

    const preSetupPolicyCtx = { policies, settings, events, etherToken, entity, entityManagerAddress }
    await Promise.all([
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_1),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_2),
      preSetupPolicy(preSetupPolicyCtx, POLICY_ATTRS_3),
    ])

    setupPolicy = async arg => {
      const { attrs, policyAddress } = policies.get(arg)

      policyProxy = await Policy.at(policyAddress)
      policy = await IPolicy.at(policyAddress)
      policyContext = await policyProxy.aclContext()
      policyOwnerAddress = entityManagerAddress

      return attrs
    }
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  describe('tranches', () => {
    const tranchNumShares = 10
    const tranchPricePerShare = 100

    describe('basic tests', () => {
      it('cannot be created without correct authorization', async () => {
        await setupPolicy(POLICY_ATTRS_1)
        await createTranch(policy, {}).should.be.rejectedWith('must be policy owner')
      })

      it('all basic values must be valid', async () => {
        await setupPolicy(POLICY_ATTRS_1)
        await createTranch(policy, { numShares: 0 }, { from: policyOwnerAddress }).should.be.rejectedWith('invalid num of shares')
        await createTranch(policy, { pricePerShareAmount: 0 }, { from: policyOwnerAddress }).should.be.rejectedWith('invalid price')
      })

      describe('a valid number of premiums must be provided', () => {
        beforeEach(async () => {
          // allow upto 4 premiums
          await setupPolicy(POLICY_ATTRS_3)
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
        await setupPolicy(POLICY_ATTRS_1)

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
        await setupPolicy(POLICY_ATTRS_1)

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

      it('can be created and will have state set to CREATED', async () => {
        await setupPolicy(POLICY_ATTRS_1)

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
        await setupPolicy(POLICY_ATTRS_1)

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

      it('cannot be created once marked as ready for approval', async () => {
        await setupPolicy(POLICY_ATTRS_2)
        await acl.assignRole(policyContext, accounts[1], ROLES.CAPITAL_PROVIDER)
        await policy.markAsReadyForApproval({ from: policyOwnerAddress })
        await createTranch(policy, {}, { from: accounts[2] }).should.be.rejectedWith('must be in created state')
      })
    })

    describe('are ERC20 tokens', () => {
      beforeEach(async () => {
        await setupPolicy(POLICY_ATTRS_1)

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

          const NAME = `NAYMS-${policyProxy.address.toLowerCase()}-TRANCH-${i + 1}`
          const SYMBOL = `N-${policyProxy.address.toLowerCase().substr(0, 6)}-${i + 1}`

          await tkn.name().should.eventually.eq(NAME)
          await tkn.symbol().should.eventually.eq(SYMBOL)
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
  })
})

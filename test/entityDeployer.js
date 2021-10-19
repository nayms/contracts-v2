import { extractEventArgs, EvmSnapshot, BYTES32_ZERO } from './utils'
import { events } from '../'
import { ensureAclIsDeployed } from '../deploy/modules/acl'
import { ensureSettingsIsDeployed } from '../deploy/modules/settings'
import { ensureEntityImplementationsAreDeployed } from '../deploy/modules/entityImplementations'
import { getAccounts } from '../deploy/utils'
import { ROLES } from '../utils/constants'

const Entity = artifacts.require("Entity")
const IEntity = artifacts.require("base/IEntity")
const EntityDeployer = artifacts.require("EntityDeployer")

describe('EntityDeployer', () => {
  const evmSnapshot = new EvmSnapshot()

  let accounts
  let acl
  let settings
  let deployer

  before(async () => {
    accounts = await getAccounts()
    acl = await ensureAclIsDeployed({ artifacts })
    settings = await ensureSettingsIsDeployed({ artifacts, acl })
    await ensureEntityImplementationsAreDeployed({ artifacts, settings })

    deployer = await EntityDeployer.new(settings.address)
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
  })

  it('does not accept ETH', async () => {
    await deployer.send(1, { from: accounts[0] }).should.be.rejected
  })

  it('is destructible by admin', async () => {
    const { address } = deployer

    await deployer.destroy().should.be.fulfilled

    await EntityDeployer.at(address).should.be.rejected
  })

  it('is not destructible by non-admin', async () => {
    await deployer.destroy({ from: accounts[1] }).should.be.rejectedWith('must be admin')
  })

  describe('can deploy an Entity', () => {
    it('but not by a non-authorized person', async () => {
      await deployer.deploy(accounts[1], BYTES32_ZERO, { from: accounts[1] }).should.be.rejectedWith('must be system manager')
    })

    it('by an admin', async () => {
      await deployer.deploy(accounts[1], BYTES32_ZERO).should.be.fulfilled
    })

    it('by a system manager', async () => {
      const context = await acl.systemContext()
      await acl.assignRole(context, accounts[1], ROLES.SYSTEM_MANAGER)

      const result = await deployer.deploy(accounts[1], BYTES32_ZERO, { from: accounts[1] })

      const eventArgs = extractEventArgs(result, events.NewEntity)

      expect(eventArgs).to.include({
        deployer: accounts[1]
      })

      await Entity.at(eventArgs.entity).should.be.fulfilled;
    })

    it('and the entity records get updated accordingly', async () => {
      await deployer.getNumChildren().should.eventually.eq(0)

      const context = await deployer.aclContext()
      await acl.assignRole(context, accounts[1], ROLES.SYSTEM_MANAGER)

      const result = await deployer.deploy(accounts[1], BYTES32_ZERO, { from: accounts[1] })
      const eventArgs = extractEventArgs(result, events.NewEntity)

      await deployer.getNumChildren().should.eventually.eq(1)
      await deployer.getChild(1).should.eventually.eq(eventArgs.entity)
      await deployer.isParentOf(eventArgs.entity).should.eventually.eq(true)

      const result2 = await deployer.deploy(accounts[1], BYTES32_ZERO, { from: accounts[1] })
      const eventArgs2 = extractEventArgs(result2, events.NewEntity)

      await deployer.getNumChildren().should.eventually.eq(2)
      await deployer.getChild(2).should.eventually.eq(eventArgs2.entity)
      await deployer.isParentOf(eventArgs2.entity).should.eventually.eq(true)
    })

    it('and entity context can be overridden', async () => {
      const context = await acl.systemContext()
      await acl.assignRole(context, accounts[1], ROLES.SYSTEM_MANAGER)

      const result = await deployer.deploy(accounts[1], context, { from: accounts[1] })

      const eventArgs = extractEventArgs(result, events.NewEntity)

      const e = await IEntity.at(eventArgs.entity);

      await e.aclContext().should.eventually.eq(context)
    })
  })
})
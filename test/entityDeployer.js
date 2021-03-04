import { extractEventArgs, EvmSnapshot } from './utils'
import { events } from '../'
import { ensureAclIsDeployed } from '../migrations/modules/acl'
import { ensureSettingsIsDeployed } from '../migrations/modules/settings'
import { ensureEntityImplementationsAreDeployed } from '../migrations/modules/entityImplementations'
import { ROLES } from '../utils/constants'

const Entity = artifacts.require("./Entity")
const IEntity = artifacts.require("./base/IEntity")
const EntityDeployer = artifacts.require("./EntityDeployer")

contract('EntityDeployer', accounts => {
  const evmSnapshot = new EvmSnapshot()

  let acl
  let settings
  let deployer

  before(async () => {
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
      await deployer.deploy(accounts[1], { from: accounts[1] }).should.be.rejectedWith('must be system manager')
    })

    it('by an admin', async () => {
      await deployer.deploy(accounts[1]).should.be.fulfilled
    })

    it('by a system manager', async () => {
      const context = await acl.systemContext()
      await acl.assignRole(context, accounts[1], ROLES.SYSTEM_MANAGER)

      const result = await deployer.deploy(accounts[1], { from: accounts[1] })

      const eventArgs = extractEventArgs(result, events.NewEntity)

      expect(eventArgs).to.include({
        deployer: accounts[1]
      })

      await Entity.at(eventArgs.entity).should.be.fulfilled;
    })

    it('and the entity records get updated accordingly', async () => {
      await deployer.getNumEntities().should.eventually.eq(0)

      const context = await deployer.aclContext()
      await acl.assignRole(context, accounts[1], ROLES.SYSTEM_MANAGER)

      const result = await deployer.deploy(accounts[1], { from: accounts[1] })
      const eventArgs = extractEventArgs(result, events.NewEntity)

      await deployer.getNumEntities().should.eventually.eq(1)
      await deployer.getEntity(0).should.eventually.eq(eventArgs.entity)

      const result2 = await deployer.deploy(accounts[1], { from: accounts[1] })
      const eventArgs2 = extractEventArgs(result2, events.NewEntity)

      await deployer.getNumEntities().should.eventually.eq(2)
      await deployer.getEntity(1).should.eventually.eq(eventArgs2.entity)
    })
  })
})
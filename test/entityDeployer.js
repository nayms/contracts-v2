import { extractEventArgs } from './utils'
import { events } from '../'

const ACL = artifacts.require("./base/ACL")
const Entity = artifacts.require("./Entity")
const EntityImpl = artifacts.require("./EntityImpl")
const EntityDeployer = artifacts.require("./EntityDeployer")

contract('EntityDeployer', accounts => {
  let acl
  let entityImpl
  let deployer

  beforeEach(async () => {
    acl = await ACL.new()
    entityImpl = await EntityImpl.new(acl.address)
    deployer = await EntityDeployer.new(acl.address, entityImpl.address)
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
    it('but not by a non-admin', async () => {
      await deployer.deploy('acme', { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('by an admin', async () => {
      const result = await deployer.deploy('acme')

      const eventArgs = extractEventArgs(result, events.NewEntity)

      expect(eventArgs).to.include({
        deployer: accounts[0]
      })

      await Entity.at(eventArgs.deployedAddress).should.be.fulfilled;
    })
  })
})

import { ensureErc1820RegistryIsDeployed } from '../migrations/utils/erc1820'
import { extractEventArgs } from './utils'
import { events } from '../'

const ACL = artifacts.require("./base/ACL")
const Policy = artifacts.require("./Policy")
const PolicyImpl = artifacts.require("./PolicyImpl")
const PolicyDeployer = artifacts.require("./PolicyDeployer")

contract('PolicyDeployer', accounts => {
  let acl
  let policyImpl
  let deployer

  before(async () => {
    await ensureErc1820RegistryIsDeployed({ artifacts, accounts, web3 })
  })

  beforeEach(async () => {
    acl = await ACL.new()
    policyImpl = await PolicyImpl.new(acl.address, "acme")
    deployer = await PolicyDeployer.new(acl.address, policyImpl.address)
  })

  it('does not accept ETH', async () => {
    await deployer.send(1, { from: accounts[0] }).should.be.rejected
  })

  it('is destructible by admin', async () => {
    const { address } = deployer

    await deployer.destroy().should.be.fulfilled

    await PolicyDeployer.at(address).should.be.rejected
  })

  it('is not destructible by non-admin', async () => {
    await deployer.destroy({ from: accounts[1] }).should.be.rejectedWith('unauthorized')
  })

  it('can deploy a Policy', async () => {
    const result = await deployer.deploy(
      'acme',
      'test'
    )

    const eventArgs = extractEventArgs(result, events.NewPolicy)

    expect(eventArgs).to.include({
      deployer: accounts[0]
    })

    await Policy.at(eventArgs.deployedAddress).should.be.fulfilled;
  })
})

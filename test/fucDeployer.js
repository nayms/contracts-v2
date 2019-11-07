import { toHex, toWei } from './utils/web3'
import { ensureErc1820RegistryIsDeployed } from '../migrations/utils/erc1820'
import { extractEventArgs } from './utils'
import { events } from '../'

const ACL = artifacts.require("./base/ACL")
const FUC = artifacts.require("./FUC")
const FUCImpl = artifacts.require("./FUCImpl")
const FUCDeployer = artifacts.require("./FUCDeployer")

contract('FUCDeployer', accounts => {
  let acl
  let fucImpl
  let deployer

  before(async () => {
    await ensureErc1820RegistryIsDeployed({ artifacts, accounts, web3 })
  })

  beforeEach(async () => {
    acl = await ACL.new()
    fucImpl = await FUCImpl.new(acl.address, "acme")
    deployer = await FUCDeployer.new(acl.address, fucImpl.address)
  })

  it('does not accept ETH', async () => {
    await deployer.send(1, { from: accounts[0] }).should.be.rejected
  })

  it('is destructible by admin', async () => {
    const { address } = deployer

    await deployer.destroy().should.be.fulfilled

    await FUCDeployer.at(address).should.be.rejected
  })

  it('is not destructible by non-admin', async () => {
    const { address } = deployer

    await deployer.destroy({ from: accounts[1] }).should.be.rejectedWith('unauthorized')
  })

  it('can deploy a FUC', async () => {
    const result = await deployer.deploy(
      'acme',
      'test'
    )

    const eventArgs = extractEventArgs(result, events.NewFUC)

    expect(eventArgs).to.include({
      deployer: accounts[0]
    })

    await FUC.at(eventArgs.deployedAddress).should.be.fulfilled;
  })
})

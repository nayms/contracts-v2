import {
  extractEventArgs,
  ADDRESS_ZERO,
} from './utils'

import {
  ensureAclIsDeployed,
} from '../migrations/utils/acl'

import { events } from '../'

const ISettingsImpl = artifacts.require("./base/ISettingsImpl")
const Proxy = artifacts.require('./base/Proxy')
const TestSettingsImpl = artifacts.require("./test/TestSettingsImpl")
const Settings = artifacts.require("./Settings")
const SettingsImpl = artifacts.require("./SettingsImpl")

contract('Settings', accounts => {
  let acl
  let settingsImpl
  let settingsProxy
  let settings

  beforeEach(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settingsImpl = await SettingsImpl.new(acl.address)
    settingsProxy = await Settings.new(
      acl.address,
      settingsImpl.address
    )
    // now let's speak to Settings contract using SettingsImpl ABI
    settings = await ISettingsImpl.at(settingsProxy.address)
  })

  it('must be deployed with a valid implementation', async () => {
    await Settings.new(
      acl.address,
      ADDRESS_ZERO
    ).should.be.rejectedWith('implementation must be valid')
  })

  it('can be deployed', async () => {
    expect(settingsProxy.address).to.exist
  })

  it('can return its implementation version', async () => {
    await settingsImpl.getImplementationVersion().should.eventually.eq('v1')
  })

  it('can return current block time', async () => {
    await settingsImpl.getTime().should.be.fulfilled
  })

  describe('can have matching market set', () => {
    it('but not just by anyone', async () => {
      await settings.setMatchingMarket(accounts[2], { from: accounts[2] }).should.be.rejectedWith('must be admin');
    })

    it('by admin', async () => {
      await settings.setMatchingMarket(accounts[2]).should.be.fulfilled
      await settings.getMatchingMarket().should.eventually.eq(accounts[2])
    })
  })

  describe('it can be upgraded', async () => {
    let settingsImpl2

    beforeEach(async () => {
      // deploy new implementation
      settingsImpl2 = await TestSettingsImpl.new()
    })

    it('but not just by anyone', async () => {
      await settingsProxy.upgrade(settingsImpl2.address, { from: accounts[1] }).should.be.rejectedWith('must be admin')
    })

    it('but not to an empty address', async () => {
      await settingsProxy.upgrade(ADDRESS_ZERO).should.be.rejectedWith('implementation must be valid')
    })

    it.skip('but not to the existing implementation', async () => {
      await settingsProxy.upgrade(settingsImpl.address).should.be.rejectedWith('already this implementation')
    })

    it('and points to the new implementation', async () => {
      const result = await settingsProxy.upgrade(settingsImpl2.address).should.be.fulfilled

      expect(extractEventArgs(result, events.Upgraded)).to.include({
        implementation: settingsImpl2.address,
        version: 'vTest',
      })
    })
  })
})

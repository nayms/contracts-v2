import {
  extractEventArgs,
  ADDRESS_ZERO,
} from './utils'

import { SETTINGS } from '../utils/constants'

import {
  ensureAclIsDeployed,
} from '../migrations/modules/acl'

import { events } from '../'

const ISettings = artifacts.require("./base/ISettings")
const Settings = artifacts.require("./Settings")

contract('Settings', accounts => {
  let acl
  let settingsImpl
  let settings

  beforeEach(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
    settingsImpl = await Settings.new(acl.address)
    settings = await ISettings.at(settingsImpl.address)
  })

  it('can return current block time', async () => {
    await settingsImpl.getTime().should.be.fulfilled
  })

  const key = SETTINGS.MARKET

  describe(`can have keys set`, () => {
    describe(`in the root context`, () => {
      it('but not just by anyone', async () => {
        await settings.setAddress(settings.address, key, accounts[3], { from: accounts[2] }).should.be.rejectedWith('must be admin');
        await settings.setBool(settings.address, key, true, { from: accounts[2] }).should.be.rejectedWith('must be admin');
        await settings.setUint256(settings.address, key, 1, { from: accounts[2] }).should.be.rejectedWith('must be admin');
        await settings.setString(settings.address, key, 'test', { from: accounts[2] }).should.be.rejectedWith('must be admin');
      })

      it('by admin', async () => {
        await settings.setAddress(settings.address, key, accounts[3]).should.be.fulfilled
        await settings.getAddress(settings.address, key).should.eventually.eq(accounts[3])
        await settings.getRootAddress(key).should.eventually.eq(accounts[3])

        await settings.setBool(settings.address, key, true).should.be.fulfilled
        await settings.getBool(settings.address, key).should.eventually.eq(true)
        await settings.getRootBool(key).should.eventually.eq(true)

        await settings.setUint256(settings.address, key, 123).should.be.fulfilled
        await settings.getUint256(settings.address, key).should.eventually.eq(123)
        await settings.getRootUint256(key).should.eventually.eq(123)

        await settings.setString(settings.address, key, 'test').should.be.fulfilled
        await settings.getString(settings.address, key).should.eventually.eq('test')
        await settings.getRootString(key).should.eventually.eq('test')
      })
    })

    describe(`in a non-root context`, () => {
      it('but not if not the context owner', async () => {
        await settings.setAddress(accounts[3], key, accounts[3], { from: accounts[2] }).should.be.rejectedWith('must be context owner');
        await settings.setBool(accounts[3], key, true, { from: accounts[2] }).should.be.rejectedWith('must be context owner');
        await settings.setUint256(accounts[3], key, 1, { from: accounts[2] }).should.be.rejectedWith('must be context owner');
        await settings.setString(accounts[3], key, 'test', { from: accounts[2] }).should.be.rejectedWith('must be context owner');
      })

      it('by context owner', async () => {
        await settings.setAddress(accounts[0], key, accounts[3]).should.be.fulfilled
        await settings.getAddress(accounts[0], key).should.eventually.eq(accounts[3])

        await settings.setBool(accounts[0], key, true).should.be.fulfilled
        await settings.getBool(accounts[0], key).should.eventually.eq(true)

        await settings.setUint256(accounts[0], key, 123).should.be.fulfilled
        await settings.getUint256(accounts[0], key).should.eventually.eq(123)

        await settings.setString(accounts[0], key, 'test').should.be.fulfilled
        await settings.getString(accounts[0], key).should.eventually.eq('test')
      })
    })
  })
})

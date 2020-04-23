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
    settings = await ISettings.at(settingsProxy.address)
  })

  it('can return current block time', async () => {
    await settingsImpl.getTime().should.be.fulfilled
  })

  for (let [key, keyValue] of Object.entries(SETTINGS)) {
    describe(`can have ${key} set`, () => {
      describe(`in the root context`, () => {
        it('but not just by anyone', async () => {
          await settings.setAddress(settings.address, keyValue, accounts[3], { from: accounts[2] }).should.be.rejectedWith('must be admin');
        })

        it('by admin', async () => {
          await settings.setAddress(settings.address, keyValue, accounts[3]).should.be.fulfilled
          await settings.getAddress(settings.address, key).should.eventually.eq(accounts[3])
        })
      })
    })
  }
})

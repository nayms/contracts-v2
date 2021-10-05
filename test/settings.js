import {
  extractEventArgs,
  ADDRESS_ZERO,
  EvmSnapshot,
} from './utils'

import { SETTINGS } from '../utils/constants'
import { ensureAclIsDeployed, } from '../deploy/modules/acl'
import { events } from '../'
import { getAccounts } from '../deploy/utils'

const ISettings = artifacts.require("./base/ISettings")
const Settings = artifacts.require("./Settings")

describe('Settings', () => {
  const evmSnapshot = new EvmSnapshot()

  let accounts
  let acl
  let settingsImpl
  let settings

  before(async () => {
    accounts = await getAccounts()
    acl = await ensureAclIsDeployed({ artifacts })
    settingsImpl = await Settings.new(acl.address)
    settings = await ISettings.at(settingsImpl.address)
  })

  beforeEach(async () => {
    await evmSnapshot.take()
  })

  afterEach(async () => {
    await evmSnapshot.restore()
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

        await settings.setAddresses(settings.address, key, [ accounts[3] ]).should.be.fulfilled
        await settings.getAddresses(settings.address, key).should.eventually.eq([ accounts[3] ])
        await settings.getRootAddresses(key).should.eventually.eq([ accounts[3] ])

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
        await settings.setAddresses(accounts[3], key, [ accounts[3] ], { from: accounts[2] }).should.be.rejectedWith('must be context owner');
        await settings.setBool(accounts[3], key, true, { from: accounts[2] }).should.be.rejectedWith('must be context owner');
        await settings.setUint256(accounts[3], key, 1, { from: accounts[2] }).should.be.rejectedWith('must be context owner');
        await settings.setString(accounts[3], key, 'test', { from: accounts[2] }).should.be.rejectedWith('must be context owner');
      })

      it('by context owner', async () => {
        await settings.setAddress(accounts[0], key, accounts[3]).should.be.fulfilled
        await settings.getAddress(accounts[0], key).should.eventually.eq(accounts[3])

        await settings.setAddresses(accounts[0], key, [ accounts[3] ]).should.be.fulfilled
        await settings.getAddresses(accounts[0], key).should.eventually.eq([ accounts[3] ])

        await settings.setBool(accounts[0], key, true).should.be.fulfilled
        await settings.getBool(accounts[0], key).should.eventually.eq(true)

        await settings.setUint256(accounts[0], key, 123).should.be.fulfilled
        await settings.getUint256(accounts[0], key).should.eventually.eq(123)

        await settings.setString(accounts[0], key, 'test').should.be.fulfilled
        await settings.getString(accounts[0], key).should.eventually.eq('test')
      })
    })

    describe('and events get emitted', () => {
      it('setAddress', async () => {
        const ret = await settings.setAddress(accounts[0], key, accounts[3])

        expect(extractEventArgs(ret, events.SettingChanged)).to.include({
          context: accounts[0],
          key,
          caller: accounts[0],
          keyType: 'address',
        })
      })

      it('setAddresses', async () => {
        const ret = await settings.setAddresses(accounts[0], key, [ accounts[3] ])

        expect(extractEventArgs(ret, events.SettingChanged)).to.include({
          context: accounts[0],
          key,
          caller: accounts[0],
          keyType: 'addresses',
        })
      })

      it('setBool', async () => {
        const ret = await settings.setBool(accounts[0], key, true)

        expect(extractEventArgs(ret, events.SettingChanged)).to.include({
          context: accounts[0],
          key,
          caller: accounts[0],
          keyType: 'bool',
        })
      })

      it('setUint256', async () => {
        const ret = await settings.setUint256(accounts[0], key, 123)

        expect(extractEventArgs(ret, events.SettingChanged)).to.include({
          context: accounts[0],
          key,
          caller: accounts[0],
          keyType: 'uint256',
        })
      })

      it('setString', async () => {
        const ret = await settings.setString(accounts[0], key, 'test')

        expect(extractEventArgs(ret, events.SettingChanged)).to.include({
          context: accounts[0],
          key,
          caller: accounts[0],
          keyType: 'string',
        })
      })
    })
  })
})

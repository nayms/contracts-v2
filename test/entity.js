import { toHex, toWei, sha3, asciiToHex } from './utils/web3'

import {
  parseEvents,
  extractEventArgs,
  hdWallet,
  ADDRESS_ZERO,
} from './utils'
import { events } from '../'

import {
  ROLE_ENTITY_ADMIN,
  ROLE_ENTITY_MANAGER,
  ROLE_ENTITY_REPRESENTATIVE
} from '../migrations/utils/acl'

import { ensureEtherTokenIsDeployed } from '../migrations/utils/etherToken'

const ACL = artifacts.require("./base/ACL")
const IEntityImpl = artifacts.require("./base/IEntityImpl")
const Entity = artifacts.require("./Entity")
const EntityImpl = artifacts.require("./EntityImpl")

contract('Entity', accounts => {
  let acl
  let entityImpl
  let entityProxy
  let entity

  beforeEach(async () => {
    acl = await ACL.new()
    entityImpl = await EntityImpl.new(acl.address, "entityImpl")
    entityProxy = await Entity.new(
      acl.address,
      entityImpl.address,
      "entity1"
    )
    // now let's speak to Entity contract using EntityImpl ABI
    entity = await IEntityImpl.at(entityProxy.address)
  })

  it('must be deployed with a valid implementation', async () => {
    await Entity.new(
      acl.address,
      ADDRESS_ZERO,
      "entity1"
    ).should.be.rejectedWith('implementation must be valid')
  })

  it('can be deployed', async () => {
    expect(entityProxy.address).to.exist
  })

  it('has its name set during deployment', async () => {
    await entity.getName().should.eventually.eq('entity1')
  })

  it('can return its implementation version', async () => {
    await entityImpl.getImplementationVersion().should.eventually.eq('v1')
  })

  describe('can have its name set', () => {
    it('but not just by anyone', async () => {
      await entity.setName('entity2').should.be.rejectedWith('unauthorized');
    })

    it.only('if caller is entity representative', async () => {
      await acl.assignRole("acme", accounts[2], ROLE_ENTITY_REPRESENTATIVE)
      await entity.setName('entity2', { from: accounts[2] }).should.be.fulfilled;
      await entity.getName().should.eventually.eq('entity2')
    })
  })

  describe('implements access control', async () => {
    beforeEach(async () => {
      await Promise.all([
        acl.assignRole("acme", accounts[3], ROLE_ASSET_MANAGER),
        acl.assignRole("acme", accounts[5], ROLE_CLIENT_MANAGER),
      ])
    })

    it('and can confirm if someone is an asset manager', async () => {
      await entityProxy.hasRole(accounts[0], ROLE_ASSET_MANAGER).should.eventually.eq(false)
      await entityProxy.hasRole(accounts[3], ROLE_ASSET_MANAGER).should.eventually.eq(true)
      await entityProxy.hasRole(accounts[4], ROLE_ASSET_MANAGER).should.eventually.eq(false)
      await entityProxy.hasRole(accounts[5], ROLE_ASSET_MANAGER).should.eventually.eq(false)
      await entityProxy.hasRole(accounts[6], ROLE_ASSET_MANAGER).should.eventually.eq(false)
    })

    it('and can confirm if someone is a client manager', async () => {
      await entityProxy.hasRole(accounts[0], ROLE_CLIENT_MANAGER).should.eventually.eq(false)
      await entityProxy.hasRole(accounts[3], ROLE_CLIENT_MANAGER).should.eventually.eq(false)
      await entityProxy.hasRole(accounts[4], ROLE_CLIENT_MANAGER).should.eventually.eq(false)
      await entityProxy.hasRole(accounts[5], ROLE_CLIENT_MANAGER).should.eventually.eq(true)
      await entityProxy.hasRole(accounts[6], ROLE_CLIENT_MANAGER).should.eventually.eq(false)
    })
  })

  describe('it can be upgraded', async () => {
    let entityImpl2
    let randomSig
    let assetMgrSig
    let clientMgrSig

    beforeEach(async () => {
      // assign asset manager
      await acl.assignRole("acme", accounts[3], ROLE_ASSET_MANAGER)
      await acl.assignRole("acme", accounts[4], ROLE_CLIENT_MANAGER)

      // deploy new implementation
      entityImpl2 = await EntityImpl.new(acl.address, "entityImplementation")

      // generate upgrade approval signatures
      const implVersion = await entityImpl2.getImplementationVersion()
      randomSig = hdWallet.sign({ address: accounts[5], data: sha3(implVersion) })
      assetMgrSig = hdWallet.sign({ address: accounts[3], data: sha3(implVersion) })
      clientMgrSig = hdWallet.sign({ address: accounts[4], data: sha3(implVersion) })
    })

    it('but not just by anyone', async () => {
      await entityProxy.upgrade(entityImpl2.address, assetMgrSig, clientMgrSig, { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('but must have asset manager\'s approval', async () => {
      await entityProxy.upgrade(entityImpl2.address, randomSig, clientMgrSig).should.be.rejectedWith('must be approved by asset mgr')
    })

    it('but must have client manager\'s approval', async () => {
      await entityProxy.upgrade(entityImpl2.address, assetMgrSig, randomSig).should.be.rejectedWith('must be approved by client mgr')
    })

    it('but not to an empty address', async () => {
      await entityProxy.upgrade(ADDRESS_ZERO, assetMgrSig, clientMgrSig).should.be.rejectedWith('implementation must be valid')
    })

    it('but not if signatures are empty', async () => {
      await entityProxy.upgrade(entityImpl.address, "0x0", "0x0").should.be.rejectedWith('valid signer not found')
    })

    it('but not to the existing implementation', async () => {
      await entityProxy.upgrade(entityImpl.address, assetMgrSig, clientMgrSig).should.be.rejectedWith('already this implementation')
    })

    it('and points to the new implementation', async () => {
      const result = await entityProxy.upgrade(entityImpl2.address, assetMgrSig, clientMgrSig).should.be.fulfilled

      expect(extractEventArgs(result, events.Upgraded)).to.include({
        implementation: entityImpl2.address,
        version: 'v1',
      })
    })
  })
})

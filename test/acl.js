import { extractEventArgs } from './utils'
import { events } from '../'
import { sha3 } from './utils/web3'
import {
  ensureAclIsDeployed,
  ROLE_ENTITY_ADMIN,
  ROLE_ENTITY_MANAGER,
  ROLE_ENTITY_REPRESENTATIVE,
  ROLE_ASSET_MANAGER,
  ROLE_CLIENT_MANAGER,
  ROLEGROUP_MANAGE_ENTITY,
  ROLEGROUP_MANAGE_POLICY,
  ROLEGROUP_APPROVE_POLICY,
} from '../migrations/utils/acl'

contract('ACL', accounts => {
  const role1 = sha3('testrole1')
  const role2 = sha3('testrole2')
  const role3 = sha3('testrole3')
  const role4 = sha3('testrole4')

  let acl

  beforeEach(async () => {
    acl = await ensureAclIsDeployed({ artifacts })
  })

  it('default account is initial admin', async () => {
    await acl.numAdmins().should.eventually.eq(1)
    await acl.isAdmin(accounts[0]).should.eventually.eq(true)
    await acl.isAdmin(accounts[1]).should.eventually.eq(false)
  })

  describe('default roles and role groups', async () => {
    it('entity admins', async () => {
      await acl.assignRole("test", accounts[1], ROLE_ENTITY_ADMIN)
      await acl.hasRoleInGroup("test", accounts[1], ROLEGROUP_MANAGE_ENTITY).should.eventually.eq(true)
    })

    it('entity managers', async () => {
      await acl.assignRole("test", accounts[1], ROLE_ENTITY_MANAGER)
      await acl.hasRoleInGroup("test", accounts[1], ROLEGROUP_MANAGE_ENTITY).should.eventually.eq(true)
      await acl.getAssigners(ROLE_ENTITY_MANAGER).should.eventually.eq([ROLE_ENTITY_ADMIN])
    })

    it('entity reps', async () => {
      await acl.assignRole("test", accounts[1], ROLE_ENTITY_REPRESENTATIVE)
      await acl.hasRoleInGroup("test", accounts[1], ROLEGROUP_MANAGE_POLICY).should.eventually.eq(true)
      await acl.getAssigners(ROLE_ENTITY_REPRESENTATIVE).should.eventually.eq([ROLE_ENTITY_MANAGER])
    })

    it('assset managers', async () => {
      await acl.assignRole("test", accounts[1], ROLE_ASSET_MANAGER)
      await acl.hasRoleInGroup("test", accounts[1], ROLEGROUP_MANAGE_POLICY).should.eventually.eq(false)
      await acl.hasRoleInGroup("test", accounts[1], ROLEGROUP_APPROVE_POLICY).should.eventually.eq(true)
      await acl.getAssigners(ROLE_ASSET_MANAGER).should.eventually.eq([ROLE_ENTITY_REPRESENTATIVE])
    })

    it('client managers', async () => {
      await acl.assignRole("test", accounts[1], ROLE_CLIENT_MANAGER)
      await acl.hasRoleInGroup("test", accounts[1], ROLEGROUP_MANAGE_POLICY).should.eventually.eq(false)
      await acl.hasRoleInGroup("test", accounts[1], ROLEGROUP_APPROVE_POLICY).should.eventually.eq(true)
      await acl.getAssigners(ROLE_CLIENT_MANAGER).should.eventually.eq([ROLE_ENTITY_REPRESENTATIVE])
    })
  })

  describe('can have new admin proposed', () => {
    it('but not by a non-admin', async () => {
      await acl.proposeNewAdmin(accounts[1], { from: accounts[2] }).should.be.rejectedWith('unauthorized')
    })

    it('unless they have already been proposed', async () => {
      await acl.proposeNewAdmin(accounts[1]).should.be.fulfilled
      await acl.proposeNewAdmin(accounts[1]).should.be.rejectedWith('already proposed')
    })

    it('unless they are already an admin', async () => {
      await acl.proposeNewAdmin(accounts[0]).should.be.rejectedWith('already an admin')
    })

    it('by an admin', async () => {
      await acl.proposeNewAdmin(accounts[1]).should.be.fulfilled
      await acl.pendingAdmins(accounts[1]).should.eventually.eq(true)
    })

    it('and emits an event when successful', async () => {
      const result = await acl.proposeNewAdmin(accounts[1])

      expect(extractEventArgs(result, events.AdminProposed)).to.include({
        addr: accounts[1]
      })
    })
  })

  describe('can have new admin proposal cancelled', () => {
    beforeEach(async () => {
      await acl.proposeNewAdmin(accounts[1]).should.be.fulfilled
    })

    it('but not by a non-admin', async () => {
      await acl.cancelNewAdminProposal(accounts[1], { from: accounts[2] }).should.be.rejectedWith('unauthorized')
    })

    it('but not if not proposed', async () => {
      await acl.cancelNewAdminProposal(accounts[2]).should.be.rejectedWith('not proposed')
    })

    it('by an admin', async () => {
      await acl.cancelNewAdminProposal(accounts[1]).should.be.fulfilled
      await acl.pendingAdmins(accounts[1]).should.eventually.eq(false)
    })

    it('and emits an event when successful', async () => {
      const result = await acl.cancelNewAdminProposal(accounts[1]).should.be.fulfilled

      expect(extractEventArgs(result, events.AdminProposalCancelled)).to.include({
        addr: accounts[1]
      })
    })
  })

  describe('can have someone accept their proposed new admin role', () => {
    beforeEach(async () => {
      await acl.proposeNewAdmin(accounts[2]).should.be.fulfilled
    })

    it('but not if they haven\'t been proposed', async () => {
      await acl.acceptAdminRole({ from: accounts[1] }).should.be.rejectedWith('not proposed')
    })

    it('but not if their proposal has been cancelled', async () => {
      await acl.cancelNewAdminProposal(accounts[2]).should.be.fulfilled
      await acl.acceptAdminRole({ from: accounts[2] }).should.be.rejectedWith('not proposed')
    })

    it('if they have actually been proposed', async () => {
      await acl.acceptAdminRole({ from: accounts[2] }).should.be.fulfilled
      await acl.isAdmin(accounts[2]).should.eventually.eq(true)
      await acl.numAdmins().should.eventually.eq(2)
    })

    it('and emits an event when successful', async () => {
      const result = await acl.acceptAdminRole({ from: accounts[2] }).should.be.fulfilled

      expect(extractEventArgs(result, events.AdminProposalAccepted)).to.include({
        addr: accounts[2]
      })
    })
  })

  describe('can have someone removed as admin', () => {
    beforeEach(async () => {
      await acl.proposeNewAdmin(accounts[2]).should.be.fulfilled
      await acl.acceptAdminRole({ from: accounts[2] }).should.be.fulfilled
      await acl.numAdmins().should.eventually.eq(2)
    })

    it('but not by a non-admin', async () => {
      await acl.removeAdmin(accounts[2], { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('but not if the person being removed is not an admin', async () => {
      await acl.removeAdmin(accounts[1]).should.be.rejectedWith('not an admin')
    })

    it('but not if they try to remove themselves', async () => {
      await acl.removeAdmin(accounts[0]).should.be.rejectedWith('cannot remove oneself')
    })

    it('but not if they are the last admin', async () => {
      await acl.removeAdmin(accounts[0], { from: accounts[2] }).should.be.fulfilled
      await acl.removeAdmin(accounts[2], { from: accounts[2] }).should.be.rejectedWith('cannot remove last admin')
    })

    it('by another admin', async () => {
      await acl.removeAdmin(accounts[0], { from: accounts[2] }).should.be.fulfilled
      await acl.isAdmin(accounts[0]).should.eventually.eq(false)
      await acl.numAdmins().should.eventually.eq(1)
    })

    it('and emits an event when successful', async () => {
      const result = await acl.removeAdmin(accounts[0], { from: accounts[2] }).should.be.fulfilled

      expect(extractEventArgs(result, events.AdminRemoved)).to.include({
        addr: accounts[0]
      })
    })
  })

  describe('can have a role group set', async () => {
    const group1 = sha3('group1')
    const group2 = sha3('group2')

    it('but not by a non-admin', async () => {
      await acl.setRoleGroup(group1, [ role1, role2 ], { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('by an admin', async () => {
      await acl.setRoleGroup(group1, [ role1, role2 ]).should.be.fulfilled
      await acl.getRoleGroup(group1).should.eventually.eq([ role1, role2 ])
    })

    it('and it updates its internal data correctly', async () => {
      await acl.setRoleGroup(group1, [role1, role2]).should.be.fulfilled
      await acl.setRoleGroup(group2, [role2, role3]).should.be.fulfilled

      await acl.getRoleGroupsForRole(role1).should.eventually.eq([ group1 ])
      await acl.getRoleGroupsForRole(role2).should.eventually.eq([ group1, group2 ])
      await acl.getRoleGroupsForRole(role3).should.eventually.eq([ group2])

      await acl.setRoleGroup(group1, [role3]).should.be.fulfilled

      await acl.getRoleGroupsForRole(role1).should.eventually.eq([])
      await acl.getRoleGroupsForRole(role2).should.eventually.eq([group2])
      await acl.getRoleGroupsForRole(role3).should.eventually.eq([group2, group1])

      await acl.getRoleGroup(group1).should.eventually.eq([role3])
      await acl.getRoleGroup(group2).should.eventually.eq([role2, role3])
    })

    it('and it works with role checking', async () => {
      await acl.assignRole('context', accounts[1], role2)

      await acl.setRoleGroup(group1, [ role1 ]).should.be.fulfilled
      await acl.hasRoleInGroup('context', accounts[1], group1).should.eventually.eq(false)

      await acl.setRoleGroup(group1, [ role1, role2 ]).should.be.fulfilled
      await acl.hasRoleInGroup('context', accounts[1], group1).should.eventually.eq(true)

      await acl.setRoleGroup(group1, []).should.be.fulfilled
      await acl.hasRoleInGroup('context', accounts[1], group1).should.eventually.eq(false)
    })

    it('and emits an event when successful', async () => {
      const result = await acl.setRoleGroup(group1, [ role1, role2 ]).should.be.fulfilled

      expect(extractEventArgs(result, events.RoleGroupUpdated)).to.include({
        roleGroup: group1
      })
    })
  })

  describe('can have a role assigned', async () => {
    it('but not by a non-admin', async () => {
      await acl.assignRole('test', accounts[2], role1, { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('by an admin', async () => {
      await acl.hasRole('test', accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole('test', accounts[2], role1).should.be.fulfilled
      await acl.hasRole('test', accounts[2], role1).should.eventually.eq(true)
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([ role1 ])
    })

    it('multiple times', async () => {
      await acl.assignRole('test', accounts[2], role1).should.be.fulfilled
      await acl.assignRole('test', accounts[2], role1).should.be.fulfilled
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([role1])
    })

    it('and another assigned', async () => {
      await acl.assignRole('test', accounts[2], role1).should.be.fulfilled
      await acl.assignRole('test', accounts[2], role2).should.be.fulfilled
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([role1, role2])
    })

    it('and emits an event when successful', async () => {
      const result = await acl.assignRole('test', accounts[2], role1).should.be.fulfilled

      expect(extractEventArgs(result, events.RoleAssigned)).to.include({
        context: 'test',
        addr: accounts[2],
        role: role1,
      })
    })
  })

  describe('can have a role unassigned', async () => {
    beforeEach(async () => {
      await acl.assignRole('test', accounts[2], role1).should.be.fulfilled
    })

    it('but not by a non-admin', async () => {
      await acl.unassignRole('test', accounts[2], role1, { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('by an admin', async () => {
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([role1])
      await acl.unassignRole('test', accounts[2], role1).should.be.fulfilled
      await acl.hasRole('test', accounts[2], role1).should.eventually.eq(false)
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([])
    })

    it('and the internal list or assigned roles is updated efficiently', async () => {
      await acl.assignRole('test', accounts[2], role2).should.be.fulfilled
      await acl.assignRole('test', accounts[2], role3).should.be.fulfilled

      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([ role1, role2, role3 ])

      // remove head of list
      await acl.unassignRole('test', accounts[2], role1).should.be.fulfilled
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([role3, role2])

      // remove end of list
      await acl.unassignRole('test', accounts[2], role2).should.be.fulfilled
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([role3])

      // remove same again, to ensure no error end of list
      await acl.unassignRole('test', accounts[2], role2).should.be.fulfilled
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([role3])

      // remove last item
      await acl.unassignRole('test', accounts[2], role3).should.be.fulfilled
      await acl.getRolesForUser('test', accounts[2]).should.eventually.eq([])
    })

    it('and emits an event when successful', async () => {
      const result = await acl.unassignRole('test', accounts[2], role1)

      expect(extractEventArgs(result, events.RoleUnassigned)).to.include({
        context: 'test',
        addr: accounts[2],
        role: role1,
      })
    })
  })

  describe('allows for multiple roles to be assigned to someone', async () => {
    beforeEach(async () => {
      await acl.assignRole('context1', accounts[2], role1).should.be.fulfilled
      await acl.assignRole('context1', accounts[2], role2).should.be.fulfilled

      await acl.assignRole('context2', accounts[2], role1).should.be.fulfilled
    })

    it('and can test for any of them', async () => {
      await acl.hasRole('context1', accounts[2], role1).should.eventually.eq(true)
      await acl.hasRole('context1', accounts[2], role2).should.eventually.eq(true)
      await acl.hasAnyRole('context1', accounts[2], [ role1, role2 ]).should.eventually.eq(true)

      await acl.hasRole('context2', accounts[2], role1).should.eventually.eq(true)
      await acl.hasAnyRole('context2', accounts[2], [ role1, role2 ]).should.eventually.eq(true)
    })
  })

  describe('allows for an assigning role to be added and removed for a role', () => {
    beforeEach(async () => {
      await acl.assignRole('test', accounts[2], role2).should.be.fulfilled
    })

    it('works', async () => {
      await acl.canAssign('test', accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole('test', accounts[1], role1, { from: accounts[2] }).should.be.rejectedWith('unauthorized')

      await acl.addAssigner(role1, role2).should.be.fulfilled

      await acl.canAssign('test', accounts[2], role1).should.eventually.eq(true)
      await acl.assignRole('test', accounts[1], role1, { from: accounts[2] }).should.be.fulfilled

      await acl.removeAssigner(role1, role2).should.be.fulfilled

      await acl.canAssign('test', accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole('test', accounts[1], role1, { from: accounts[2] }).should.be.rejectedWith('unauthorized')
    })

    it('and ensures no duplicates exist in list of all assigners for a given role', async () => {
      await acl.addAssigner(role1, role2).should.be.fulfilled
      await acl.addAssigner(role1, role2).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([ role2 ])
    })

    it('and ensures that an item can be removed from the list of all assigners efficiently', async () => {
      // 3 items
      await acl.addAssigner(role1, role2).should.be.fulfilled
      await acl.addAssigner(role1, role3).should.be.fulfilled
      await acl.addAssigner(role1, role4).should.be.fulfilled

      await acl.getAssigners(role1).should.eventually.eq([ role2, role3, role4 ])

      // remove head of list
      await acl.removeAssigner(role1, role2).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([ role4, role3 ])

      // remove end of list
      await acl.removeAssigner(role1, role3).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([role4])

      // try same again, to ensure no error is thrown
      await acl.removeAssigner(role1, role3).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([role4])

      // remove last item
      await acl.removeAssigner(role1, role4).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([])
    })
  })
})

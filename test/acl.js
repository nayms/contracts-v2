import { extractEventArgs } from './utils'
import { events } from '../'
import { sha3 } from './utils/web3'
import { deployAcl } from '../migrations/modules/acl'

contract('ACL', accounts => {
  const role1 = sha3('testrole1')
  const role2 = sha3('testrole2')
  const role3 = sha3('testrole3')
  const role4 = sha3('testrole4')

  const roleGroup1 = sha3('rolegroup1')
  const roleGroup2 = sha3('rolegroup2')
  const roleGroup3 = sha3('rolegroup3')

  const context1 = sha3('test1')
  const context2 = sha3('test2')
  const context3 = sha3('test3')

  let acl
  let systemContext
  let adminRole
  let adminRoleGroup

  beforeEach(async () => {
    acl = await deployAcl({ artifacts })
    systemContext = await acl.systemContext()
    adminRole = await acl.adminRole()
    adminRoleGroup = await acl.adminRoleGroup()
  })

  it('default account is initial admin', async () => {
    await acl.isAdmin(accounts[0]).should.eventually.eq(true)
    await acl.isAdmin(accounts[1]).should.eventually.eq(false)
  })

  describe('can have new admin added', () => {
    it('but not by a non-admin', async () => {
      await acl.addAdmin(accounts[1], { from: accounts[2] }).should.be.rejectedWith('unauthorized')
    })

    it('by an admin', async () => {
      await acl.isAdmin(accounts[1]).should.eventually.eq(false)
      await acl.addAdmin(accounts[1]).should.be.fulfilled
      await acl.getNumUsersInContext(systemContext).should.eventually.eq(2)
      await acl.isAdmin(accounts[1]).should.eventually.eq(true)
    })

    it('and makes no difference if they get added again', async () => {
      await acl.isAdmin(accounts[1]).should.eventually.eq(false)
      await acl.addAdmin(accounts[1]).should.be.fulfilled
      await acl.addAdmin(accounts[1]).should.be.fulfilled
      await acl.getNumUsersInContext(systemContext).should.eventually.eq(2)
      await acl.isAdmin(accounts[1]).should.eventually.eq(true)
    })

    it('and emits an event when successful', async () => {
      const result = await acl.addAdmin(accounts[1])

      expect(extractEventArgs(result, events.RoleAssigned)).to.include({
        context: systemContext,
        addr: accounts[1],
        role: adminRole,
      })
    })
  })

  describe('can have someone removed as admin', () => {
    beforeEach(async () => {
      await acl.addAdmin(accounts[2]).should.be.fulfilled
      await acl.getNumUsersInContext(systemContext).should.eventually.eq(2)
      await acl.isAdmin(accounts[2]).should.eventually.eq(true)
    })

    it('but not by a non-admin', async () => {
      await acl.removeAdmin(accounts[2], { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('by another admin', async () => {
      await acl.removeAdmin(accounts[0], { from: accounts[2] }).should.be.fulfilled
      await acl.isAdmin(accounts[0]).should.eventually.eq(false)
      await acl.getNumUsersInContext(systemContext).should.eventually.eq(1)
    })

    it('and it makes no difference if they are removed twice', async () => {
      await acl.removeAdmin(accounts[0], { from: accounts[2] }).should.be.fulfilled
      await acl.removeAdmin(accounts[0], { from: accounts[2] }).should.be.fulfilled
      await acl.isAdmin(accounts[0]).should.eventually.eq(false)
      await acl.getNumUsersInContext(systemContext).should.eventually.eq(1)
    })

    it('and it makes no difference if they removed themselves', async () => {
      await acl.removeAdmin(accounts[0]).should.be.fulfilled
      await acl.isAdmin(accounts[0]).should.eventually.eq(false)
      await acl.getNumUsersInContext(systemContext).should.eventually.eq(1)
      await acl.getUserInContextAtIndex(systemContext, 0).should.eventually.eq(accounts[2])
    })

    it('and emits an event when successful', async () => {
      const result = await acl.removeAdmin(accounts[0], { from: accounts[2] })

      expect(extractEventArgs(result, events.RoleUnassigned)).to.include({
        context: systemContext,
        addr: accounts[0],
        role: adminRole,
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
      await acl.assignRole(context1, accounts[1], role2)

      await acl.setRoleGroup(group1, [ role1 ]).should.be.fulfilled
      await acl.hasRoleInGroup(context1, accounts[1], group1).should.eventually.eq(false)

      await acl.setRoleGroup(group1, [ role1, role2 ]).should.be.fulfilled
      await acl.hasRoleInGroup(context1, accounts[1], group1).should.eventually.eq(true)

      await acl.setRoleGroup(group1, []).should.be.fulfilled
      await acl.hasRoleInGroup(context1, accounts[1], group1).should.eventually.eq(false)
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
      await acl.assignRole(context1, accounts[2], role1, { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('by an admin', async () => {
      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(true)
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([ role1 ])
    })

    it('by the context owner', async () => {
      const callerContext = await acl.generateContextFromAddress(accounts[4])
      await acl.hasRole(callerContext, accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole(callerContext, accounts[2], role1, { from: accounts[4] }).should.be.fulfilled
      await acl.hasRole(callerContext, accounts[2], role1).should.eventually.eq(true)
      await acl.getRolesForUser(callerContext, accounts[2]).should.eventually.eq([role1])
    })

    it('multiple times', async () => {
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([role1])
    })

    it('and another assigned', async () => {
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.assignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([role1, role2])
    })

    it('by someone who can assign', async () => {
      await acl.setRoleGroup(roleGroup1, [ role2 ])
      await acl.addAssigner(role1, roleGroup1)
      await acl.assignRole(context1, accounts[3], role2)

      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole(context1, accounts[2], role1, { from: accounts[3] }).should.be.fulfilled
      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(true)
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([role1])
    })

    it('and emits an event when successful', async () => {
      const result = await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled

      expect(extractEventArgs(result, events.RoleAssigned)).to.include({
        context: context1,
        addr: accounts[2],
        role: role1,
      })
    })

    it('and if assigned in the system context then it automatically applies to all other contexts', async () => {
      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(false)

      await acl.assignRole(systemContext, accounts[2], role1).should.be.fulfilled

      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(true)
      await acl.hasRole(context2, accounts[2], role1).should.eventually.eq(true)
    })

    it('cannot be assigned in the system context by a non-admin', async () => {
      // remove admin role but become assigner via rolegroup
      await acl.setRoleGroup(roleGroup1, [role2])
      await acl.addAssigner(role1, roleGroup1)
      await acl.assignRole(systemContext, accounts[0], role2)
      await acl.unassignRole(systemContext, accounts[0], adminRole)

      await acl.assignRole(systemContext, accounts[2], role1, { from: accounts[0] }).should.be.rejectedWith('only admin can assign role in system context')
    })
  })

  describe('can have a role unassigned', async () => {
    beforeEach(async () => {
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
    })

    it('but not by a non-admin', async () => {
      await acl.unassignRole(context1, accounts[2], role1, { from: accounts[1] }).should.be.rejectedWith('unauthorized')
    })

    it('by an admin', async () => {
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([role1])
      await acl.unassignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(false)
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([])
    })

    it('and the internal list of assigned roles is updated efficiently', async () => {
      await acl.assignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.assignRole(context1, accounts[2], role3).should.be.fulfilled

      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([ role1, role2, role3 ])

      // remove head of list
      await acl.unassignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([role3, role2])

      // remove end of list
      await acl.unassignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([role3])

      // remove same again, to ensure no error end of list
      await acl.unassignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([role3])

      // remove last item
      await acl.unassignRole(context1, accounts[2], role3).should.be.fulfilled
      await acl.getRolesForUser(context1, accounts[2]).should.eventually.eq([])
    })

    it('and emits an event when successful', async () => {
      const result = await acl.unassignRole(context1, accounts[2], role1)

      expect(extractEventArgs(result, events.RoleUnassigned)).to.include({
        context: context1,
        addr: accounts[2],
        role: role1,
      })
    })
  })

  describe('allows for multiple roles to be assigned to someone', async () => {
    beforeEach(async () => {
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.assignRole(context1, accounts[2], role2).should.be.fulfilled

      await acl.assignRole(context2, accounts[2], role1).should.be.fulfilled
    })

    it('and can test for any of them', async () => {
      await acl.hasRole(context1, accounts[2], role1).should.eventually.eq(true)
      await acl.hasRole(context1, accounts[2], role2).should.eventually.eq(true)
      await acl.hasAnyRole(context1, accounts[2], [ role1, role2 ]).should.eventually.eq(true)

      await acl.hasRole(context2, accounts[2], role1).should.eventually.eq(true)
      await acl.hasAnyRole(context2, accounts[2], [ role1, role2 ]).should.eventually.eq(true)
    })
  })

  describe('allows for an assigning rolegroup to be added and removed for a role', () => {
    beforeEach(async () => {
      await acl.setRoleGroup(roleGroup1, [role1, role2, role3])
      await acl.setRoleGroup(roleGroup2, [role1, role2, role3])
      await acl.setRoleGroup(roleGroup3, [role1, role2, role3])

      await acl.assignRole(context1, accounts[2], role2).should.be.fulfilled
    })

    it('fails to add as assigner if role group doesn\'t exist', async () => {
      await acl.setRoleGroup(roleGroup1, [])
      await acl.addAssigner(role1, roleGroup1).should.be.rejectedWith('must be role group')
    })

    it('fails to remove as assigner if role group doesn\'t exist', async () => {
      await acl.setRoleGroup(roleGroup1, [])
      await acl.removeAssigner(role1, roleGroup1).should.be.rejectedWith('must be role group')
    })

    it('works', async () => {
      await acl.canAssign(context1, accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole(context1, accounts[1], role1, { from: accounts[2] }).should.be.rejectedWith('unauthorized')

      await acl.addAssigner(role1, roleGroup1).should.be.fulfilled

      await acl.canAssign(context1, accounts[2], role1).should.eventually.eq(true)
      await acl.assignRole(context1, accounts[1], role1, { from: accounts[2] }).should.be.fulfilled

      await acl.removeAssigner(role1, roleGroup1).should.be.fulfilled

      await acl.canAssign(context1, accounts[2], role1).should.eventually.eq(false)
      await acl.assignRole(context1, accounts[1], role1, { from: accounts[2] }).should.be.rejectedWith('unauthorized')
    })

    it('and ensures no duplicates exist in list of all assigners for a given role', async () => {
      await acl.addAssigner(role1, roleGroup1).should.be.fulfilled
      await acl.addAssigner(role1, roleGroup1).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([ roleGroup1 ])
    })

    it('and ensures that an item can be removed from the list of all assigners efficiently', async () => {
      // 3 items
      await acl.addAssigner(role1, roleGroup1).should.be.fulfilled
      await acl.addAssigner(role1, roleGroup2).should.be.fulfilled
      await acl.addAssigner(role1, roleGroup3).should.be.fulfilled

      await acl.getAssigners(role1).should.eventually.eq([ roleGroup1, roleGroup2, roleGroup3 ])

      // remove head of list
      await acl.removeAssigner(role1, roleGroup1).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([ roleGroup3, roleGroup2 ])

      // remove end of list
      await acl.removeAssigner(role1, roleGroup2).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([ roleGroup3 ])

      // try same again, to ensure no error is thrown
      await acl.removeAssigner(role1, roleGroup2).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([roleGroup3])

      // remove last item
      await acl.removeAssigner(role1, roleGroup3).should.be.fulfilled
      await acl.getAssigners(role1).should.eventually.eq([])
    })
  })

  describe('stores list of all created contexts', () => {
    it('that gets updated when a role is assigned', async () => {
      await acl.getNumContexts().should.eventually.eq(1)

      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled

      await acl.getNumContexts().should.eventually.eq(2)
      await acl.getContextAtIndex(0).should.eventually.eq(systemContext)
      await acl.getContextAtIndex(1).should.eventually.eq(context1)

      await acl.assignRole(context1, accounts[2], role2).should.be.fulfilled

      // should be no change in context count
      await acl.getNumContexts().should.eventually.eq(2)

      await acl.assignRole(context2, accounts[2], role2).should.be.fulfilled

      // now we expect a change
      await acl.getNumContexts().should.eventually.eq(3)
      await acl.getContextAtIndex(1).should.eventually.eq(context1)
      await acl.getContextAtIndex(2).should.eventually.eq(context2)
    })
  })

  describe('tracks contexts -> users and vice versa', () => {
    it('and ensures the list of users in a context stays up-to-date', async () => {
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.assignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.assignRole(context1, accounts[3], role1).should.be.fulfilled
      await acl.assignRole(context1, accounts[3], role2).should.be.fulfilled
      await acl.assignRole(context1, accounts[4], role1).should.be.fulfilled
      await acl.assignRole(context1, accounts[4], role2).should.be.fulfilled

      // initial state
      await acl.getNumUsersInContext(context1).should.eventually.eq(3)
      await acl.getUserInContextAtIndex(context1, 0).should.eventually.eq(accounts[2])
      await acl.getUserInContextAtIndex(context1, 1).should.eventually.eq(accounts[3])
      await acl.getUserInContextAtIndex(context1, 2).should.eventually.eq(accounts[4])

      // remove user's first role
      await acl.unassignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.getNumUsersInContext(context1).should.eventually.eq(3)
      // remove user's other role
      await acl.unassignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.getNumUsersInContext(context1).should.eventually.eq(2)
      await acl.getUserInContextAtIndex(context1, 0).should.eventually.eq(accounts[4])
      await acl.getUserInContextAtIndex(context1, 1).should.eventually.eq(accounts[3])

      // remove another user
      await acl.unassignRole(context1, accounts[4], role2).should.be.fulfilled
      await acl.unassignRole(context1, accounts[4], role1).should.be.fulfilled
      await acl.getNumUsersInContext(context1).should.eventually.eq(1)
      await acl.getUserInContextAtIndex(context1, 0).should.eventually.eq(accounts[3])

      // do same again to ensure no difference or error
      await acl.unassignRole(context1, accounts[4], role2).should.be.fulfilled
      await acl.unassignRole(context1, accounts[4], role1).should.be.fulfilled
      await acl.getNumUsersInContext(context1).should.eventually.eq(1)
      await acl.getUserInContextAtIndex(context1, 0).should.eventually.eq(accounts[3])

      // remove final user
      await acl.unassignRole(context1, accounts[3], role2).should.be.fulfilled
      await acl.unassignRole(context1, accounts[3], role1).should.be.fulfilled
      await acl.getNumUsersInContext(context1).should.eventually.eq(0)
    })

    it('and ensures the list of contexts for a user stays up-to-date', async () => {
      await acl.assignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.assignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.assignRole(context2, accounts[2], role1).should.be.fulfilled
      await acl.assignRole(context3, accounts[2], role1).should.be.fulfilled

      // check initial state
      await acl.getNumContextsForUser(accounts[2]).should.eventually.eq(3)
      await acl.getContextForUserAtIndex(accounts[2], 0).should.eventually.eq(context1)
      await acl.getContextForUserAtIndex(accounts[2], 1).should.eventually.eq(context2)
      await acl.getContextForUserAtIndex(accounts[2], 2).should.eventually.eq(context3)

      // remove one role in a context
      await acl.unassignRole(context1, accounts[2], role2).should.be.fulfilled
      await acl.getNumContextsForUser(accounts[2]).should.eventually.eq(3)
      // remove the other role in the context
      await acl.unassignRole(context1, accounts[2], role1).should.be.fulfilled
      await acl.getNumContextsForUser(accounts[2]).should.eventually.eq(2)
      await acl.getContextForUserAtIndex(accounts[2], 0).should.eventually.eq(context3)
      await acl.getContextForUserAtIndex(accounts[2], 1).should.eventually.eq(context2)

      // remove second context
      await acl.unassignRole(context2, accounts[2], role1).should.be.fulfilled
      await acl.getNumContextsForUser(accounts[2]).should.eventually.eq(1)
      await acl.getContextForUserAtIndex(accounts[2], 0).should.eventually.eq(context3)

      // try same again, to ensure no difference or error
      await acl.unassignRole(context2, accounts[2], role1).should.be.fulfilled
      await acl.getNumContextsForUser(accounts[2]).should.eventually.eq(1)
      await acl.getContextForUserAtIndex(accounts[2], 0).should.eventually.eq(context3)

      // remove final context
      await acl.unassignRole(context3, accounts[2], role1).should.be.fulfilled
      await acl.getNumContextsForUser(accounts[2]).should.eventually.eq(0)
    })
  })
})

# Architectural overview

This is high-level architectural guide to the Nayms smart contracts.

## ACL (access control list)

There are numerous stakeholders in the Nayms platform, all of whom have varying degrees of control and access to different parts of the platform. To accomodate for this complexity we utilize an [ACL](https://github.com/nayms/contracts/commits/master/contracts/ACL.sol) (access control list). This is a singleton contract instance into which all of our other contracts call.

The address to the ACL is stored in the `Settings` contract.

### Contexts

Roles are assigned within a **context**, which are like separate namespaces. This allows for fine-grained role assignment,e.g: _Address A can have role B in context C but not context D_:

![PNG image-9019824EE033-1](https://user-images.githubusercontent.com/266594/118675754-c4ffd000-b7f2-11eb-8c3b-f13b44f4ee3a.png)

Thus, when we look up role assignemnts we always supply a role context.

Note, however, that there is such a thing as the **System context**. This is the core context of the ACL contract itself. If an address is assigned a role within this context then it is taken to have that role in _all_ contexts. For this reason you should be 
very careful about assigning roles within the System context:

![syscontext](https://user-images.githubusercontent.com/266594/118675360-73efdc00-b7f2-11eb-8bef-d546f201d673.png)

A context is just a `bytes32` value, and so the easiest way to generate a context value is to use the `keccak256` method to hash an input string, address, whatever. By convention the context of a given contract or user address is the `keccak256` hash of the address.

### Assigning roles

Any address can be assigned to any role within any context, as long as the _assigner_ (i.e. `msg.sender`) has permission to make such an assignment. Permission is based on atleast one of the following conditions being true:

* The context is the caller's own
* The caller is a System admin
* The caller has a role which belongs to a role group that is allowed to assign this role

Note what the first condition states: any caller can assign roles within _their own_ context. Since by convention the context of an address is simply the `keccak256` hash of that address it's possible for the ACL to calculate the context of the caller and then check to see if the assignment is being made within that context.

This means that smart contracts can assign roles within their own contexts - and indeed we make use of this functionality in our Policy smart contracts.

Note that the permissions required to un-assign a role are the same as for assigning.

### Role groups

Authorization within our smart contracts is processed on the basis of role groups. Role groups are simply groupings of on or more under specific labels. This allows us to enable multiple roles access to certain parts of the platform without having to individually check for each role.

![rolegroups](https://user-images.githubusercontent.com/266594/118687840-5ffda780-b7fd-11eb-84b5-2e488c4640c4.png)

Role groups can be allowed to assign roles. For example, the `ENTITY_ADMINS` role group is allowed to assign the `ENTITY_MANAGER` role. This means that an address that has been assigned a role belonging to the `ENTITY_ADMINS` role group will be able to assign the `ENTITY_MANAGER` role to itself and others. 

The [ACL deployment script](https://github.com/nayms/contracts/blob/master/migrations/modules/acl.js) has the full list of role groups.

### System admin

**System admins** are the most powerful actors in the Nayms system since they have access to anything and everything, including upgrading the smart contract logic. To be precise, any address which has a role that is part of the `SYSTEM_ADMINS` role group can do this. And since the only role in this group is the `SYSTEM_ADMIN` role, this means that only addresses with the `SYSTEM_ADMIN` role assigned have this level of access. Furthermore, assignment must be made in the System context.

They can assign any role within any context. And they are also the only group of actors who are allowed to modify the assigning capabilities of role groups.

Since this role is so powerful, upon initial of our smart contracts we set our [Gnosis SAFE](https://gnosis-safe.io/) multisig as the sole address with this role. This ensures that all future actions taken at the System admin level require n-of-m signatures via the multisig.  



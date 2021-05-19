# Architectural overview

This is high-level architectural guide to the Nayms smart contracts.

## Upgradeability

Our [Entity](#entities) and [Policy](#policies) contracts are fully upgradeable, meaning we can fix bugs and release new features for these without have to redeploy existing contracts at new addresses. 

We use the [Diamond Standard](https://hiddentao.com/archives/2020/05/28/upgradeable-smart-contracts-using-diamond-standard) to allow for virtually infinite-size smart contracts where every single function can be implemented within a separate contract if we so wished. The main entrypoint contract acts as a proxy, forwarding every incoming call to the appropriate implementation contract based on an internal lookup-table:

![delegateproxy](https://user-images.githubusercontent.com/266594/118700115-35feb200-b80a-11eb-87b6-6fa22d501135.png)

Taking entities as example, we have an [EntityDelegate](https://github.com/nayms/contracts/blob/master/contracts/EntityDelegate.sol) contract which acts as a singleton proxy. All actual entities then _virtually point_ to this one:

![delegateproxy2](https://user-images.githubusercontent.com/266594/118700852-fe443a00-b80a-11eb-94ea-e71614ccee41.png)

When a call comes in to an `Entity` it uses the lookup table inside the `EntityDelegate` to work out which implementation contract to call. Thus, when we wish to upgrade the code for our entities we only need to update the `EntityDelegate` singleton!

Note that contract upgrades can only be performed by a [System admin](#system-admin).

## ACL

There are numerous stakeholders in the Nayms platform, all of whom have varying degrees of control and access to different parts of the platform. To accomodate for this complexity we utilize an [ACL](https://github.com/nayms/contracts/commits/master/contracts/ACL.sol) (access control list). This is a singleton contract instance into which all of our other contracts call.

The address to the ACL is stored in the [Settings](#settings) contract.

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
* The caller is a [System admin](#system-admin)
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


## Settings

Our [Settings contract](https://github.com/nayms/contracts/blob/master/contracts/Settings.sol) is a singleton contract instance that acts as a global data store for our platfom. 

It exposes a simple key-value storage interface where setting a value can only be done by [System admins](#system-admin).

We pass the address of the Settings contract in the constructor when deploying all other contracts (except the [ACL](#acl), since Settings uses the ACL to authorize writes). Once deployed, a contract can lookup the addresses of other relevant contracts in the system via the Settings contract.

## Entities

All stakeholders are represented by [Entity](https://github.com/nayms/contracts/blob/master/contracts/Entity.sol) contracts.

![entity](https://user-images.githubusercontent.com/266594/118809113-1a46ea80-b8a2-11eb-94e6-ca53a70e35fd.png)

Anyone can deposit funds into an entity but only entity admins can withdraw. Entities can use these balances to invest in (i.e. collateralize) policies. Entities also have an internal _treasury_ which is where policy collateral (and premium payments) is actually stored. Funds can be transferred between the entity's "normal" balance and its treasury balance as long as its treasury's collateralization ratio is honoured.

The treasury has a _virtual balance_, which is the balance it expects to have according to the policies it has collateralized as well as pending claims. It has a _real balance_, which is its actual balance. And it has a collateralization ratio set, which is essentially of the virtual balance to the real balance. 

_For example, if the collateraliation ration is 25% then the real balance must always be atleast 25% of the virtual balance._

When a claim needs to be paid out and there is not enough balance to do so, the claim gets added to the internal claim queue in the treasury. As soon as new funds are received (via transfer from the entity "normal" balance) any pending claims get paid out automatically.



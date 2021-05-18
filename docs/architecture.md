# Architectural overview

This is high-level architectural guide to the Nayms smart contracts.

## ACL (access control list)

There are numerous stakeholders in the Nayms platform, all of whom have varying degrees of control and access to different parts of the platform. To accomodate for this complexity we utilize an [ACL](https://github.com/nayms/contracts/commits/master/contracts/ACL.sol) (access control list). This is a singleton contract instance into which all of our other contracts call.

### Contexts

Roles are assigned within a **context**, which are like separate namespaces. This allows for fine-grained role assignment,e.g: _Address A can have role B in context C but not context D_:

![PNG image-9019824EE033-1](https://user-images.githubusercontent.com/266594/118675754-c4ffd000-b7f2-11eb-8c3b-f13b44f4ee3a.png)

Thus, when we look up role assignemnts we always supply a role context.

Note, however, that there is such a thing as the **System context**. This is the core context of the ACL contract itself. If an address is assigned a role within this context then it is taken to have that role in _all_ contexts. For this reason you should be 
very careful about assigning roles within the System context:

![syscontext](https://user-images.githubusercontent.com/266594/118675360-73efdc00-b7f2-11eb-8bef-d546f201d673.png)

A context is just a `bytes32` value, and so the easiest way to generate a context value is to use the `keccak256` method to hash an input string, address, whatever. By convention the context of a given contract or user address is the `keccak256` hash of the address.

### Assigning roles

### System admin

### Role groups

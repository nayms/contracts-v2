pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/Proxy.sol";

contract Entity is AccessControl, Proxy {
  constructor (
    address _acl,
    address _entityImpl,
    string memory _name
  ) AccessControl(_acl) Proxy(_entityImpl) public {
    dataString["name"] = _name;
  }

  function upgrade (address _implementation, bytes memory _sig) public assertIsAdmin {
    address signer = getUpgradeSigner(_implementation, _sig);

    require(hasRole(signer, ROLE_ENTITY_ADMIN), 'must be approved by entity admin');

    setImplementation(_implementation);
  }
}

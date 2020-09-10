pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/IDiamondInitializerFacet.sol";

abstract contract CommonInitializerFacet is Controller, IDiamondInitializerFacet {
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {
    // empty
  }

  function initialize () public override {
    require(!dataBool["initialized"], 'already initialized');
    dataBool["initialized"] = true;

    doInitialization();
  }

  function doInitialization () internal virtual;
}


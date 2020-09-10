pragma solidity >=0.6.7;

import "./CommonInitializerFacet.sol";

contract PolicyInitializerFacet is CommonInitializerFacet {
  constructor (address _acl, address _settings)
    CommonInitializerFacet(_acl, _settings)
    public
  {
    // empty
  }

  // CommonInitializerFacet //

  function doInitialization () internal override {
    // nothing to do!
  }
}

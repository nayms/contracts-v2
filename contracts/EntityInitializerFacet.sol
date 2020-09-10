pragma solidity >=0.6.7;

import "./CommonInitializerFacet.sol";
import "./EntityToken.sol";

contract EntityInitializerFacet is CommonInitializerFacet {
  constructor (address _acl, address _settings)
    CommonInitializerFacet(_acl, _settings)
    public
  {
    // empty
  }

  // CommonInitializerFacet //

  function doInitialization()
    internal
    override
  {
    EntityToken t = new EntityToken(address(this));
    dataAddress["token"] = address(t);
  }
}

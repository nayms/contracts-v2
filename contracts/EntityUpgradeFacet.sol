pragma solidity >=0.6.7;

import "./CommonUpgradeFacet.sol";
import "./EntityToken.sol";

contract EntityUpgradeFacet is CommonUpgradeFacet {
  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    CommonUpgradeFacet(_acl, _settings)
    public
  {
  }
}


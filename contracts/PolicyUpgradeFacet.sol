pragma solidity >=0.6.7;

import "./CommonUpgradeFacet.sol";

contract PolicyUpgradeFacet is CommonUpgradeFacet {
  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    CommonUpgradeFacet(_acl, _settings)
    public
  {
  }
}


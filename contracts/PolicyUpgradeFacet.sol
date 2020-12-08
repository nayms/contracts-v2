pragma solidity >=0.6.7;

import "./CommonUpgradeFacet.sol";

contract PolicyUpgradeFacet is CommonUpgradeFacet {
  /**
   * Constructor
   */
  constructor (address _settings) CommonUpgradeFacet(_settings) public {
    // empty
  }
}


pragma solidity 0.6.12;

import "./CommonUpgradeFacet.sol";

contract TreasuryUpgradeFacet is CommonUpgradeFacet {
  /**
   * Constructor
   */
  constructor (address _settings) CommonUpgradeFacet(_settings) public {
  }
}


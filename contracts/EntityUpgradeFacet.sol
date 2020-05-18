pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IDiamondUpgradeFacet.sol";

 contract EntityUpgradeFacet is EternalStorage, Controller, IDiamondUpgradeFacet {
  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {
    // empty
  }

  // IDiamondUpgradeFacet

  function upgrade (address[] memory _facets) public override {
    revert('not yet!')
  }
}

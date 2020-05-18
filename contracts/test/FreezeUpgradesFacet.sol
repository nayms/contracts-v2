pragma solidity >=0.6.7;

import '../base/IDiamondFacet.sol';
import '../base/IDiamondUpgradeFacet.sol';

contract FreezeUpgradesFacet is IDiamondUpgradeFacet {
  // IDiamondUpgradeFacet

  function upgrade (address[] memory /*_facets*/) public override {
    revert('frozen');
  }
}

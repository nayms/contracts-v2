pragma solidity 0.6.12;

import '../base/IDiamondFacet.sol';
import '../base/IDiamondUpgradeFacet.sol';

contract FreezeUpgradesFacet is IDiamondUpgradeFacet {
  // IDiamondUpgradeFacet

  function upgrade (address[] memory /*_facets*/) public override {
    revert('frozen');
  }

  function getVersionInfo () public override pure returns (string memory _num, uint256 _date, string memory _hash) {
    // empty
  }
}

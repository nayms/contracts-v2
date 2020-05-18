pragma solidity >=0.6.7;

import "./IDiamondFacet.sol";

abstract contract IDiamondUpgradeFacet is IDiamondFacet {
  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IDiamondUpgradeFacet.upgrade.selector
    );
  }

  // methods

  function upgrade (address[] memory _facets) public virtual;
}



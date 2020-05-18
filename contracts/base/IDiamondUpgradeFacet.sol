pragma solidity >=0.6.7;

import "./IDiamondFacet.sol";

interface IDiamondUpgradeFacetInterface {
  function upgrade (address[] calldata _facets) external;
}

abstract contract IDiamondUpgradeFacet is IDiamondFacet, IDiamondUpgradeFacetInterface {
  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IDiamondUpgradeFacetInterface.upgrade.selector
    );
  }
}



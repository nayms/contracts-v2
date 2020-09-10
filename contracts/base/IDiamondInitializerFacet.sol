pragma solidity >=0.6.7;

import "./EternalStorage.sol";
import "./IDiamondFacet.sol";
import "./IDiamondProxy.sol";

abstract contract IDiamondInitializerFacet is IDiamondFacet {
  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IDiamondInitializerFacet.initialize.selector
    );
  }

  // methods

  function initialize () public virtual;
}



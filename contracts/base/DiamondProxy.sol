pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

/******************************************************************************\
Forked from https://github.com/mudgen/Diamond/blob/master/contracts/DiamondExample.sol
/******************************************************************************/

import "./DiamondStorageBase.sol";

import "./IDiamondCutFacet.sol";
import "./DiamondCutFacet.sol";

import "./IDiamondLoupeFacet.sol";
import "./DiamondLoupeFacet.sol";

import "./IDiamondFacet.sol";

abstract contract DiamondProxy is DiamondStorageBase {
  constructor () public {
    // Create a DiamondCutFacet contract
    DiamondCutFacet diamondFacet = new DiamondCutFacet();
    dataAddress["diamondCutFacet"] = address(diamondFacet);

    // Create a DiamondLoupeFacet contract which implements the Diamond Loupe interface
    DiamondLoupeFacet diamondLoupeFacet = new DiamondLoupeFacet();

    bytes[] memory changes = new bytes[](2);

    // Adding cut function
    changes[0] = abi.encodePacked(diamondFacet, IDiamondCutFacet.diamondCut.selector);

    // Adding diamond loupe functions
    changes[1] = abi.encodePacked(
      diamondLoupeFacet,
      IDiamondLoupeFacet.facetFunctionSelectors.selector,
      IDiamondLoupeFacet.facets.selector,
      IDiamondLoupeFacet.facetAddress.selector,
      IDiamondLoupeFacet.facetAddresses.selector
    );

    // execute cut function
    _upgradeDiamond(changes);
  }


  function _upgradeDiamond (bytes[] memory _changes) internal {
    bytes memory cutFunction = abi.encodeWithSelector(IDiamondCutFacet.diamondCut.selector, _changes);
    (bool success,) = dataAddress["diamondCutFacet"].delegatecall(cutFunction);
    require(success, "Adding functions failed.");
  }


  function _registerFacets (address[] memory _facets) internal {
    bytes[] memory changes = new bytes[](_facets.length);

    for (uint i = 0; i < _facets.length; i += 1) {
      IDiamondFacet f = IDiamondFacet(_facets[i]);
      bytes memory selectors = f.getSelectors();
      changes[i] = abi.encodePacked(_facets[i], selectors);
    }

    _upgradeDiamond(changes);
  }


  // Finds facet for function that is called and executes the
  // function if it is found and returns any value.
  fallback() external payable {
    require(msg.sig != IDiamondCutFacet.diamondCut.selector, "Direct diamondCut disallowed");

    DiamondStorage storage ds = diamondStorage();
    address facet = address(bytes20(ds.facets[msg.sig]));
    require(facet != address(0), "Function does not exist.");

    assembly {
      let ptr := mload(0x40)
      calldatacopy(ptr, 0, calldatasize())
      let result := delegatecall(gas(), facet, ptr, calldatasize(), 0, 0)
      let size := returndatasize()
      returndatacopy(ptr, 0, size)
      switch result
      case 0 {revert(ptr, size)}
      default {return (ptr, size)}
    }
  }

  receive() external payable {
  }
}

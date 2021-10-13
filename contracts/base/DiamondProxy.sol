// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

/******************************************************************************\
Forked from https://github.com/mudgen/Diamond/blob/master/contracts/DiamondExample.sol
/******************************************************************************/

import "./DiamondStorageBase.sol";
import "./DiamondCutter.sol";
import "./IDiamondFacet.sol";
import "./IDiamondProxy.sol";

abstract contract DiamondProxy is DiamondStorageBase, IDiamondProxy {
  constructor () public {
    DiamondCutter diamondCutter = new DiamondCutter();
    dataAddress["diamondCutter"] = address(diamondCutter);
  }

  // IDiamondProxy

  function registerFacets (address[] memory _facets) public override {
    require(msg.sender == address(this), 'external caller not allowed');
    _registerFacets(_facets);
  }

  // Public methods 
  
  function resolveFacet (bytes4 _sig) public view virtual returns (address) {
    DiamondStorage storage ds = diamondStorage();
    return address(bytes20(ds.facets[_sig]));
  }

  // Internal methods

  function _registerFacets (address[] memory _facets) internal {
    bytes[] memory changes = new bytes[](_facets.length);

    for (uint i = 0; i < _facets.length; i += 1) {
      IDiamondFacet f = IDiamondFacet(_facets[i]);
      bytes memory selectors = f.getSelectors();
      changes[i] = abi.encodePacked(_facets[i], selectors);
    }

    _cut(changes);
  }

  // Private methods

  function _cut (bytes[] memory _changes) private {
    bytes memory cutFunction = abi.encodeWithSelector(DiamondCutter.diamondCut.selector, _changes);
    (bool success,) = dataAddress["diamondCutter"].delegatecall(cutFunction);
    require(success, "Adding functions failed.");
  }

  // Finds facet for function that is called and executes the
  // function if it is found and returns any value.
  fallback() external payable {
    address facet = resolveFacet(msg.sig);
    require(facet != address(0), "Facet not found");

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

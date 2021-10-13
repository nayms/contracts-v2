// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IDiamondProxy {
  function registerFacets (address[] calldata _facets) external;
}



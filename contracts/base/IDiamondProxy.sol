// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

interface IDiamondProxy {
  function registerFacets (address[] calldata _facets) external;
}



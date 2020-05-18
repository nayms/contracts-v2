pragma solidity >=0.6.7;

interface IDiamondProxy {
  function registerFacets (address[] calldata _facets) external;
}



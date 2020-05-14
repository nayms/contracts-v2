pragma solidity >=0.6.7;

interface IDiamondFacet {
  function getSelectors () external pure returns (bytes memory);
}



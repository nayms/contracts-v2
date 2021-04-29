pragma solidity 0.6.12;

interface IDiamondFacet {
  function getSelectors () external pure returns (bytes memory);
}



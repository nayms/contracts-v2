pragma solidity >=0.6.7;

import "../base/EternalStorage.sol";
import '../base/IDiamondFacet.sol';

interface IEntityTreasuryTestFacet is IDiamondFacet {
}

contract EntityTreasuryTestFacet is EternalStorage, IEntityTreasuryTestFacet {
  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked();
  }
}

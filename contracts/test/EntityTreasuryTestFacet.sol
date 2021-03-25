pragma solidity >=0.6.7;

import "../base/EternalStorage.sol";
import '../base/IDiamondFacet.sol';

interface IEntityTreasuryTestFacet is IDiamondFacet {
  function setAsMyPolicy (address _addr) external;
}

contract EntityTreasuryTestFacet is EternalStorage, IEntityTreasuryTestFacet {
  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityTreasuryTestFacet.setAsMyPolicy.selector
    );
  }

  function setAsMyPolicy (address _addr) public override {
    dataBool[__a(_addr, "isPolicy")] = true;
  }
}

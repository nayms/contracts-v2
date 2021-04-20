pragma solidity >=0.6.7;

import "../base/EternalStorage.sol";
import '../base/IDiamondFacet.sol';

interface IEntityTreasuryTestFacet is IDiamondFacet {
  function setRealBalance(address _unit, uint256 _bal) external;
}

contract EntityTreasuryTestFacet is EternalStorage, IEntityTreasuryTestFacet {
  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityTreasuryTestFacet.setRealBalance.selector
    );
  }

  function setRealBalance(address _unit, uint256 _bal) external override {
    dataUint256[__a(_unit, "treasuryRealBalance")] = _bal;
  }
}

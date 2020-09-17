pragma solidity >=0.6.7;

import "./EternalStorage.sol";
import "./IDiamondFacet.sol";
import "./IDiamondProxy.sol";

abstract contract IDiamondUpgradeFacet is IDiamondFacet {
  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IDiamondUpgradeFacet.upgrade.selector,
      IDiamondUpgradeFacet.getVersionInfo.selector
    );
  }

  // methods

  function upgrade (address[] memory _facets) public virtual;
  function getVersionInfo () public virtual view returns (uint256 num_, uint256 date_, string memory hash_);
}



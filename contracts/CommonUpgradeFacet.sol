// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./base/Controller.sol";
import "./base/IDiamondUpgradeFacet.sol";
import "./base/IDiamondProxy.sol";

contract CommonUpgradeFacet is Controller, IDiamondUpgradeFacet {
  constructor (address _settings) Controller(_settings) public {
    // empty
  }

  function upgrade (address[] memory _facets) public override assertIsAdmin {
    IDiamondProxy(address(this)).registerFacets(_facets);
  }

  function getVersionInfo () public override pure returns (string memory num_, uint256 date_, string memory hash_) {
    num_ = "1.0.0-build.1970";
    date_ = 1655727561;
    hash_ = "ffd004ebb3697f6c6e612c118bfa4cc7be0b9a5c";
  }
}

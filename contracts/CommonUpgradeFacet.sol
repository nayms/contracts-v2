pragma solidity >=0.6.7;

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
    num_ = "1.0.0-local.1628513627830";
    date_ = 1628513627;
    hash_ = "7dea73d2eccf56a77852d858c6197283546e8be8";
  }
}

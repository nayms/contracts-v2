// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

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
    num_ = "1.0.0-local.1637846745255";
    date_ = 1637846745;
    hash_ = "b1e7ce9e4ab847a3d9ae9eedd0c7c429a72044b1";
  }
}

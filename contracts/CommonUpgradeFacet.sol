pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/IDiamondUpgradeFacet.sol";
import "./VersionInfo.sol";

contract CommonUpgradeFacet is Controller, IDiamondUpgradeFacet, VersionInfo {
  constructor (address _settings) Controller(_settings) public {
    // empty
  }

  function upgrade (address[] memory _facets) public override assertIsAdmin {
    IDiamondProxy(address(this)).registerFacets(_facets);
  }

  function getVersionInfo () public override pure returns (string memory num_, uint256 date_, string memory hash_) {
    num_ = VERSION_NUM;
    date_ = VERSION_DATE;
    hash_ = VERSION_GITCOMMIT;
  }
}


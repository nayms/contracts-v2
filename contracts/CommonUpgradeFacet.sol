// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/Controller.sol";
import "./base/IDiamondUpgradeFacet.sol";
import "./base/IDiamondProxy.sol";

contract CommonUpgradeFacet is Controller, IDiamondUpgradeFacet {
    constructor(address _settings) Controller(_settings) {
        // empty
    }

    function upgrade(address[] memory _facets) public override assertIsAdmin {
        IDiamondProxy(address(this)).registerFacets(_facets);
    }

    function getVersionInfo()
        public
        pure
        override
        returns (
            string memory num_,
            uint256 date_,
            string memory hash_
        )
    {
        num_ = "1.0.0-build.dev1648881199382";
        date_ = 1648881199;
        hash_ = "7a600d5c0d84633ddce6dd03877d02979446fabe";
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/EternalStorage.sol";
import "./base/IFeeBankCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";
import "./base/IERC20.sol";
import "./base/ReentrancyGuard.sol";

contract FeeBankCoreFacet is EternalStorage, Controller, IDiamondFacet, IFeeBankCoreFacet, ReentrancyGuard {
    /**
     * Constructor
     */
    constructor(address _settings) Controller(_settings) {}

    // IDiamondFacet

    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(IFeeBankCoreFacet.getBalance.selector);
    }

    // IFeeBankCoreFacet

    function getBalance(address _unit) public view override returns (uint256) {
        return IERC20(_unit).balanceOf(address(this));
    }
}

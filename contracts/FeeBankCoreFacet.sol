// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/IFeeBankCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";
import "./base/SafeMath.sol";
import "./base/IERC20.sol";
import "./base/ReentrancyGuard.sol";

contract FeeBankCoreFacet is EternalStorage, Controller, IDiamondFacet, IFeeBankCoreFacet, ReentrancyGuard {
  using SafeMath for uint256;
  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IFeeBankCoreFacet.getBalance.selector
    );
  }

  // IFeeBankCoreFacet

  function getBalance(address _unit) public view override returns (uint256) {
    return IERC20(_unit).balanceOf(address(this));
  }
}

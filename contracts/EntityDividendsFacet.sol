// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityDividendsFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/SafeMath.sol";
import "./base/Strings.sol";
import "./EntityFacetBase.sol";
import "./EntityToken.sol";

contract EntityDividendsFacet is EternalStorage, Controller, EntityFacetBase, IEntityDividendsFacet, IDiamondFacet {
  using SafeMath for uint256;
  using Strings for string;

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityDividendsFacet.getNumTokenHolders.selector,
      IEntityDividendsFacet.getTokenHolderAtIndex.selector,
      IEntityDividendsFacet.payDividend.selector,
      IEntityDividendsFacet.getWithdrawableDividend.selector,
      IEntityDividendsFacet.withdrawDividend.selector
    );
  }


  // IEntityDividendsFacet

  function getNumTokenHolders() external view override returns (uint256) {
    return dataUint256["numTokenHolders"];
  }

  function getTokenHolderAtIndex(uint256 _index) external view override returns (address) {
    return dataAddress[__i(_index, "tokenHolder")];
  }

  function payDividend(address _unit, uint256 _amount) external override {
    // if a sale is in progress then some tokens are hold by market on behalf of entity
    // - let's wait until tokens have been allocated to holder
    _assertNoTokenSaleInProgress();

    _assertHasEnoughBalance(_unit, _amount);

    uint256 supply = dataUint256["tokenSupply"];
    uint256 numHolders = dataUint256["numTokenHolders"];
    uint256 entityBal = dataUint256[__a(_unit, "balance")];

    for (uint256 i = 1; numHolders >= i; i += 1) {
      // get user and balance
      address a = dataAddress[__i(i, "tokenHolder")];
      uint256 bal = dataUint256[__a(a, "tokenBalance")];
      // calculate dividend
      uint256 div = bal.mul(_amount).div(supply);
      // transfer
      entityBal = entityBal.sub(div);
      string memory divKey = __iaa(0, a, _unit, "dividend");
      dataUint256[divKey] = dataUint256[divKey].add(div);
    }

    dataUint256[__a(_unit, "balance")] = entityBal;
  }

  function getWithdrawableDividend(address _unit, address _holder) external view override returns (uint256) {
    string memory divKey = __iaa(0, _holder, _unit, "dividend");
    return dataUint256[divKey];
  }

  function withdrawDividend(address _unit) external override {
    string memory divKey = __iaa(0, msg.sender, _unit, "dividend");
    
    uint256 div = dataUint256[divKey];

    if (div > 0) {
      dataUint256[divKey] = 0;
      IERC20(_unit).transfer(msg.sender, div);
    }
  }
}

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
      IEntityDividendsFacet.getTokenHolderAtIndex.selector
    );
  }


  // IEntityDividendsFacet

  function getNumTokenHolders() external view override returns (uint256) {
    return dataUint256["numTokenHolders"];
  }

  function getTokenHolderAtIndex(uint256 _index) external view override returns (address) {
    return dataAddress[__i(_index, "tokenHolder")];
  }
}

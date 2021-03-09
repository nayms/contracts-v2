pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IPolicyTreasury.sol";
import "./base/IDiamondFacet.sol";

/**
 * @dev Business-logic for policy treasuries
 */
 contract EntityTreasuryFacet is EternalStorage, Controller, IPolicyTreasury, IDiamondFacet {
  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyTreasury.sellTranchTokens.selector
    );
  }


  // IPolicyTreasury

  function sellTranchTokens (address _token, uint256 _tokenAmount, address _priceUnit, uint256 _priceAmount) 
    public 
    override
  {

  }
}

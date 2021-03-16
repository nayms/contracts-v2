pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/EntityFacetBase.sol";
import "./base/IPolicyTreasury.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IERC20.sol";
import "./base/IDiamondFacet.sol";

/**
 * @dev Business-logic for policy treasuries
 */
 contract EntityTreasuryFacet is EternalStorage, Controller, EntityFacetBase, IPolicyTreasury, IDiamondFacet {
  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyTreasury.createOrder.selector,
      IPolicyTreasury.cancelOrder.selector,
      IPolicyTreasury.payClaim.selector
    );
  }


  // IPolicyTreasury

  function createOrder (address _sellUnit, uint256 _sellAmount, address _buyUnit, uint256 _buyAmount)
    public 
    override
    assertIsMyPolicy(msg.sender)
    returns (uint256)
  {
    return _tradeOnMarket(_sellUnit, _sellAmount, _buyUnit, _buyAmount);
  }

  function cancelOrder (uint256 _orderId) 
    public 
    override 
    assertIsMyPolicy(msg.sender)
  {
    IMarket mkt = _getMarket();
    if (mkt.isActive(_orderId)) {
      mkt.cancel(_orderId);
    }
  }

  function payClaim (address _recipient, uint256 _amount)
    public
    override
    assertIsMyPolicy(msg.sender)
  {
    address policyUnitAddress;
    {
      uint256 i1;
      uint256 i2;
      uint256 i3;
      address a1;
      (a1, i1, i2, i3, policyUnitAddress, , , , , ,) = IPolicyCoreFacet(msg.sender).getInfo();
    }

    IERC20(policyUnitAddress).transfer(_recipient, _amount);
  }
}

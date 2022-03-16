// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityFundingFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./EntityFacetBase.sol";

contract EntityFundingFacet is EternalStorage, Controller, EntityFacetBase, IEntityFundingFacet, IDiamondFacet {

  modifier assertCanTradeTrancheTokens () {
    require(inRoleGroup(msg.sender, ROLEGROUP_TRADERS), 'must be trader');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityFundingFacet.getBalance.selector,
      IEntityFundingFacet.deposit.selector,
      IEntityFundingFacet.withdraw.selector,
      IEntityFundingFacet.trade.selector,
      IEntityFundingFacet.sellAtBestPrice.selector
    );
  }


  // IEntityFundingFacet

  function getBalance(address _unit) public view override returns (uint256) {
    return dataUint256[__a(_unit, "balance")];
  }

  function deposit(address _unit, uint256 _amount) 
    external 
    override 
  {
    IERC20 tok = IERC20(_unit);
    tok.transferFrom(msg.sender, address(this), _amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")] + _amount;
    
    emit EntityDeposit(msg.sender, _unit, _amount);
  }

  function withdraw(address _unit, uint256 _amount) 
    external 
    override 
    assertIsEntityAdmin(msg.sender)
  {
    require(dataUint256["tokenSupply"] == 0, "cannot withdraw while tokens exist");

    _assertHasEnoughBalance(_unit, _amount);

    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")] - _amount;

    IERC20 tok = IERC20(_unit);
    tok.transfer(msg.sender, _amount);

    emit EntityWithdraw(msg.sender, _unit, _amount);
  }

  function trade(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount)
    external
    override
    assertCanTradeTrancheTokens
    returns (uint256)
  {
    // check balance
    _assertHasEnoughBalance(_payUnit, _payAmount);
    // do it
    return _tradeOnMarket(_payUnit, _payAmount, _buyUnit, _buyAmount, FEE_SCHEDULE_STANDARD, address(0), "");
  }

  function sellAtBestPrice(address _sellUnit, uint256 _sellAmount, address _buyUnit)
    external
    override
    assertCanTradeTrancheTokens
  {
    // check balance
    _assertHasEnoughBalance(_sellUnit, _sellAmount);
    // do it!
    _sellAtBestPriceOnMarket(_sellUnit, _sellAmount, _buyUnit);
  }
}

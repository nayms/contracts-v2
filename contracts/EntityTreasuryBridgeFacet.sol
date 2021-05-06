pragma solidity 0.6.12;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./EntityTreasuryFacetBase.sol";
import "./base/IPolicyTreasury.sol";
import "./base/IEntityTreasuryBridgeFacet.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IERC20.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";

/**
 * @dev Business-logic for policy treasuries inside entities
 */
 contract EntityTreasuryBridgeFacet is EternalStorage, Controller, EntityTreasuryFacetBase, IEntityTreasuryBridgeFacet, IDiamondFacet {
  using SafeMath for uint256;

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityTreasuryBridgeFacet.transferFromTreasury.selector,
      IEntityTreasuryBridgeFacet.transferToTreasury.selector,
      IEntityTreasuryBridgeFacet.getCollateralRatio.selector,
      IEntityTreasuryBridgeFacet.setCollateralRatio.selector
    );
  }

  // IEntityTreasuryBridgeFacet

  function getCollateralRatio() public view override returns (
    uint256 treasuryCollRatioBP_
  ) {
    treasuryCollRatioBP_ = dataUint256["treasuryCollRatioBP"];
  }

  function setCollateralRatio(uint256 _treasuryCollRatioBP) external override assertIsEntityAdmin(msg.sender) {
    require(_treasuryCollRatioBP > 0, "cannot be 0");
    dataUint256["treasuryCollRatioBP"] = _treasuryCollRatioBP;
  }

  function transferToTreasury(address _unit, uint256 _amount) public override {
    _assertHasEnoughBalance(_unit, _amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].sub(_amount);
    string memory trbKey = __a(_unit, "treasuryRealBalance");
    dataUint256[trbKey] = dataUint256[trbKey].add(_amount);
    _resolveClaims(_unit);
    emit TransferToTreasury(msg.sender, _unit, _amount);
  }

  function transferFromTreasury(address _unit, uint256 _amount) public override {
    // check if we have enough balance
    string memory trbKey = __a(_unit, "treasuryRealBalance");
    string memory tmbKey = __a(_unit, "treasuryMinBalance");
    require(dataUint256[trbKey] >= _amount, "exceeds treasury balance");

    // check if minimum coll ratio is maintained
    uint256 collBal = dataUint256[tmbKey].mul(10000 * dataUint256["treasuryCollRatioBP"]).div(10000 * 10000);
    require(dataUint256[trbKey].sub(_amount) >= collBal, "collateral too low");

    dataUint256[trbKey] = dataUint256[trbKey].sub(_amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].add(_amount);
    emit TransferFromTreasury(msg.sender, _unit, _amount);
  }
}

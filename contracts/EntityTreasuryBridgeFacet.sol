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
      IEntityTreasuryBridgeFacet.transferToTreasury.selector
    );
  }

  // IEntityTreasuryBridgeFacet

  function transferToTreasury(address _unit, uint256 _amount) external override {
    _assertHasEnoughBalance(_unit, _amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].sub(_amount);
    string memory trbKey = __a(_unit, "treasuryRealBalance");
    dataUint256[trbKey] = dataUint256[trbKey].add(_amount);
    _resolveClaims(_unit);
    emit TransferToTreasury(msg.sender, _unit, _amount);
  }

  function transferFromTreasury(address _unit, uint256 _amount) external override {
    // check if we have enough balance
    string memory trbKey = __a(_unit, "treasuryRealBalance");
    require(dataUint256[trbKey] >= _amount, "exceeds treasury balance");

    dataUint256[trbKey] = dataUint256[trbKey].sub(_amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].add(_amount);
    emit TransferFromTreasury(msg.sender, _unit, _amount);
  }
}

pragma solidity >=0.6.7;

/**
 * @dev Entity treasury helper facet logic.
 */
interface IEntityTreasuryBridgeFacet {
  /**
   * @dev Get treasury collaterlization ratio.
   *
   * @return treasuryCollRatioBP_ Treasury collateralization ratio.
   */
  function getCollateralRatio() external view returns (
    uint256 treasuryCollRatioBP_
  );

  /**
   * @dev Set treasury collateralization raiot.
   *
   * @param _treasuryCollRatioBP Treasury collateralization ratio basis points.
   */
  function setCollateralRatio(uint256 _treasuryCollRatioBP) external;

  /**
   * @dev Transfer assets from the internal balance to the treasury balance.
   *
   * @param _unit Asset to move.
   * @param _amount Amount to move.
   */
  function transferToTreasury(address _unit, uint256 _amount) external;

  /**
   * @dev Transfer assets from the treasury to the internal balance.
   *
   * @param _unit Asset to move.
   * @param _amount Amount to move.
   */
  function transferFromTreasury(address _unit, uint256 _amount) external;

  /**
   * @dev Emitted when assets are moved from internal balance to treasury.
   * @param caller The caller.
   * @param unit The asset moved.
   * @param amount The amount moved.
   */
  event TransferToTreasury (
    address indexed caller,
    address indexed unit,
    uint256 indexed amount
  );

  /**
   * @dev Emitted when assets are moved to internal balance from treasury.
   * @param caller The caller.
   * @param unit The token moved.
   * @param amount The amount moved.
   */
  event TransferFromTreasury (
    address indexed caller,
    address indexed unit,
    uint256 indexed amount
  );
}

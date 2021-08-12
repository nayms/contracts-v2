pragma solidity 0.6.12;

interface IMarketConfigFacet {
  /**
   * @dev Get market config info.
   *
   * @return dust_ The dist value.
   * @return feeBP_ The fee value in basis points.
   */
  function getConfig() external view returns (
    uint256 dust_,
    uint256 feeBP_
  );

  /**
   * @dev Set market fee.
   *
   * @param _feeBP The fee value in basis points.
   */
  function setFee(uint256 _feeBP) external;
}

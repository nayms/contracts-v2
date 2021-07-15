pragma solidity 0.6.12;

/**
 * @dev Entity dividends facet.
 */
interface IEntityDividendsFacet {
  /**
   * @dev Get no. of token holders.
   */
  function getNumTokenHolders() external view returns (uint256);

  /**
   * @dev Get token holder at given 1-based index.
   */
  function getTokenHolderAtIndex(uint256 _index) external view returns (address);
}

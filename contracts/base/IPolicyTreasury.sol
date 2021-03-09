pragma solidity >=0.6.7;

interface IPolicyTreasury {
  /**
   * @dev Trade tranch tokens on the market.
   *
   * @param _token Tranch token address.
   * @param _tokenAmount The amount to sell.
   * @param _priceUnit The current to sell for.
   * @param _priceAmount The total amount to sell for.
   *
   * @return Market offer id.
   */
  function tradeTokens (address _token, uint256 _tokenAmount, address _priceUnit, uint256 _priceAmount) external returns (uint256);
}

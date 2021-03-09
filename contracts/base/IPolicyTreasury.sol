pragma solidity >=0.6.7;

interface IPolicyTreasury {
  /**
   * @dev Offer tranch tokens on the market as part of the initial sale.
   * @param _token Tranch token address.
   * @param _tokenAmount The amount to sell.
   * @param _priceUnit The current to sell for.
   * @param _priceAmount The total amount to sell for.
   */
  function sellTranchTokens (address _token, uint256 _tokenAmount, address _priceUnit, uint256 _priceAmount) external;
}

pragma solidity >=0.6.7;

/**
 * @dev Entity token minting and burning.
 */
interface IEntityTokenMinterFacet {
  /**
   * @dev Get token address.
   *
   * @param _unit Asset represented by the token.
   *
   * @return Token address.
   */
  function getTokenAddress(address _unit) external view returns (address);

  /**
   * @dev Calculate no. of entity tokens caller will receive for given deposit amount.
   *
   * @param _unit Asset to deposit.
   * @param _amount Amount to deposit.
   *
   * @return No. of tokens that will be received.
   */
  function calculateTokensReceivable(address _unit, uint256 _amount) external view returns (uint256);

  /**
   * @dev Calculate amount of the underlying asset that can be redeemed using given token amount.
   *
   * @param _token Token to redeem.
   * @param _amount Amount to redeem.
   *
   * @return Amount of underlying asset that will be received.
   */
  function calculateAssetsRedeemable(address _token, uint256 _amount) external view returns (uint256);

  /**
   * @dev Deposit assets and obtain enitty. tokens.
   *
   * The caller should ensure the entity has been pre-approved to transfer the asset on their behalf.
   *
   * @param _unit Asset to deposit.
   * @param _amount Amount to deposit.
   */
  function deposit(address _unit, uint256 _amount) external;

  /**
   * @dev Redeem tokens for underlying assets.
   *
   * The caller will recieved the redeemed assets. The caller should ensure the entity has been pre-approved to 
   * transfer the token.
   *
   * @param _token Entity token to redeem.
   * @param _amount Amount of token to redeem.
   */
  function redeem(address _token, uint256 _amount) external;
}

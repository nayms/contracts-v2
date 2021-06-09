pragma solidity 0.6.12;

interface ITreasuryCoreFacet {
  /**
   * @dev Register with the treasury.
   *
   * The caller address will recorded within the treasury and a virtual balance for the caller will be setup. From this point onwards 
   * the caller can have their funds stored in the treasury.
   *
   * Note: this call is idempotent.
   */
  function register () external;

  /**
   * @dev Transfer from caller balance to recipient balance.
   *
   * If this recipient is registered with the treasury then the call will simply result in respective balances
   * getting updated. Otherwise the call will result in tokens actually being sent to the recipient address.
   * 
   * @param _token Token unit.
   * @param _recipient Recipient.
   * @param _amount Amount to transfer.
   */
  function transferTo (address _token, address _recipient, uint256 _amount) external;

  /**
   * @dev Increase the caller's recorded balance.
   *
   * Be careful when calling this! The caller is responsible for ensuring that the required no. of tokens have actually been 
   * transferred to the treasury prior to calling this.
   * 
   * @param _token Token unit.
   * @param _amount Amount to increase balance by.
   */
  function incBalance (address _token, uint256 _amount) external;
}

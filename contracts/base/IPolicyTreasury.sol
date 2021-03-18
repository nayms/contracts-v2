pragma solidity >=0.6.7;

interface IPolicyTreasury {
  /**
   * @dev Create a market order.
   *
   * @param _type Order type.
   * @param _sellUnit Unit to sell.
   * @param _sellAmount Amount to sell.
   * @param _buyUnit Unit to buy.
   * @param _buyAmount Amount to buy.
   *
   * @return Market order id.
   */
  function createOrder (bytes32 _type, address _sellUnit, uint256 _sellAmount, address _buyUnit, uint256 _buyAmount) external returns (uint256);
  /**
   * @dev Cancel token sale order.
   *
   * @param _orderId Market order id
   */
  function cancelOrder (uint256 _orderId) external;
  /**
   * Pay a claim.
   *
   * Once paid the internal minimum collateral level required for the policy will be automatically reduced.
   *
   * @param _recipient Recipient address.
   * @param _amount Amount to pay.
   */
  function payClaim (address _recipient, uint256 _amount) external;
  /**
   * Increase policy treasury balance.
   *
   * This should only be called by a policy to inform the treasury to update its 
   * internal record of the policy's current balance, e.g. after premium payments are sent to the treasury.
   *
   * @param _amount Amount to increase by.
   */
   function incPolicyBalance (uint256 _amount) external;
  /**
   * Set minimum balance required to fully collateralize the policy.
   *
   * This can only be called once.
   *
   * @param _amount Amount to increase by.
   */
   function setMinPolicyCollateral (uint256 _amount) external;
}

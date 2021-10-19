// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IPolicyTreasury {

  /**
   * @dev Get aggregate treasury info for given token.
   *
   * @param _unit Token unit.
   * @return realBalance_ Current real balance.
   * @return virtualBalance_ Current virtual balance (sum of all policy balances).
   * @return minBalance_ Current minimum balance needed (sum of all policy minimum balances).
   */
  function getEconomics (address _unit) external view returns (
    uint256 realBalance_,
    uint256 virtualBalance_,
    uint256 minBalance_
  );

  /**
   * @dev Get treasury info for given policy.
   *
   * @param _policy Policy address.
   * @return unit_ Token.
   * @return balance_ Current balance.
   * @return minBalance_ Min. requried balance to fully collateralize policy.
   * @return claimsUnpaidTotalAmount_ Total amount unpaid across all claims for policy.
   */
  function getPolicyEconomics (address _policy) external view returns (
    address unit_,
    uint256 balance_,
    uint256 minBalance_,
    uint256 claimsUnpaidTotalAmount_
  );

  /**
   * @dev Get claim queue info.
   *
   * @param _unit Token unit.
   * @return count_ No. of pending claims (both paid and unpaid).
   * @return unpaidCount_ No. of unpaid pending claims.
   * @return unpaidTotalAmount_ Total amount unpaid across all claims.
   */
  function getClaims (address _unit) external view returns (
    uint256 count_,
    uint256 unpaidCount_,
    uint256 unpaidTotalAmount_
  );


  /**
   * @dev Get queued claim.
   *
   * @param _unit Token unit.
   * @param _index 1-based claim index.
   * @return policy_ The policy.
   * @return recipient_ Claim recipient.
   * @return amount_ Claim amount.
   * @return paid_ Whether claim has been paid yet.
   */
  function getClaim (address _unit, uint256 _index) external view returns (
    address policy_,
    address recipient_,
    uint256 amount_,
    bool paid_
  );


  /**
   * @dev Create a market order.
   *
   * @param _type Order type.
   * @param _sellUnit Unit to sell.
   * @param _sellAmount Amount to sell.
   * @param _buyUnit Unit to buy.
   * @param _buyAmount Amount to buy.
   * @param _feeSchedule Fee schedule to use.
   * @param _notify Observer to notify of trade and/or closure.
   * @param _notifyData Extra metadata to pass to observer.
   *
   * @return Market order id.
   */
  function createOrder (
    bytes32 _type, 
    address _sellUnit, 
    uint256 _sellAmount, 
    address _buyUnit, 
    uint256 _buyAmount,
    uint256 _feeSchedule,
    address _notify,
    bytes calldata _notifyData
  ) external returns (uint256);
  /**
   * @dev Cancel token sale order.
   *
   * @param _orderId Market order id
   */
  function cancelOrder (uint256 _orderId) external;
  /**
   * Pay a claim for the callig policy.
   *
   * Once paid the internal minimum collateral level required for the policy will be automatically reduced.
   *
   * @param _recipient Recipient address.
   * @param _amount Amount to pay.
   */
  function payClaim (address _recipient, uint256 _amount) external;
  /**
   * Increase calling policy treasury balance.
   *
   * This should only be called by a policy to inform the treasury to update its 
   * internal record of the policy's current balance, e.g. after premium payments are sent to the treasury.
   *
   * @param _amount Amount to add or remove.
   */
  function incPolicyBalance (uint256 _amount) external;
  /**
   * Set minimum balance required to fully collateralize the calling policy.
   *
   * This can only be called once.
   *
   * @param _amount Amount to increase by.
   */
  function setMinPolicyBalance (uint256 _amount) external;
  /**
   * Get whether the given policy is fully collaterlized without any "debt" (e.g. pending claims that are yet to be paid out).
   */
  function isPolicyCollateralized (address _policy) external view returns (bool);

  /**
   * Resolve all unpaid claims with available treasury funds.
   *
   * @param _unit Token unit.
   */
  function resolveClaims (address _unit) external;
}

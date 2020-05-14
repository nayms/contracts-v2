pragma solidity >=0.6.7;

/**
 * @dev Entities.
 */
interface IEntityImpl {
  /**
   * @dev Create a new policy.
   * @param _initiationDate The initiation date (seconds since epoch).
   * @param _startDate The start date (seconds since epoch).
   * @param _maturationDate The maturation date (seconds since epoch).
   * @param _unit The payment unit.
   * @param _premiumIntervalSeconds The time between successive premium payments (seconds).
   * @param _brokerCommissionBP The commission to pay the broker (1 = 0.1%)
   * @param _assetManagerCommissionBP The commission to pay the asset manager (1 = 0.1%)
   * @param _naymsCommissionBP The commission to pay Nayms (1 = 0.1%)
   */
  function createPolicy(
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256 _brokerCommissionBP,
    uint256 _assetManagerCommissionBP,
    uint256 _naymsCommissionBP
  ) external;

  /**
   * @dev Get no. of policies created.
   * @return Total no. of policies created.
   */
  function getNumPolicies() external view returns (uint256);
  /**
   * @dev Get policy.
   * @return Policy at given index.
   */
  function getPolicy(uint256 _index) external view returns (address);

  /**
   * @dev Deposit assets.
   *
   * The caller should ensure the entity has been pre-approved to transfer the asset on their behalf.
   *
   * @param _unit Asset to deposit.
   * @param _amount Amount to deposit.
   */
  function deposit(address _unit, uint256 _amount) external;
  /**
   * @dev Withdraw assets.
   *
   * The caller will recieved the withdrawn assets.
   *
   * @param _unit Asset to withdraw.
   * @param _amount Amount to withdraw.
   */
  function withdraw(address _unit, uint256 _amount) external;

  /**
   * @dev Pay the next expected premium for a tranch using the assets owned by this entity.
   *
   * @param _policy Policy which owns the tranch.
   * @param _tranchIndex Index of the tranch in the policy.
   */
  function payTranchPremium(address _policy, uint256 _tranchIndex) external;

  /**
   * @dev Trade assets at a specific price-point.
   *
   * @param _payUnit Asset to sell.
   * @param _payAmount Amount to sell.
   * @param _buyUnit Asset to buy.
   * @param _buyAmount Amount to buy.
   */
  function trade(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount) external;
  /**
   * @dev Sell given asset at the best possible price.
   *
   * Note that this call only succeeds if the full amount (`_sellAmount`) can be sold.
   *
   * @param _sellUnit Asset to sell.
   * @param _sellAmount Amount to sell.
   * @param _buyUnit Asset to buy.
   */
  function sellAtBestPrice(address _sellUnit, uint256 _sellAmount, address _buyUnit) external;

  /**
   * @dev Emitted when a new policy has been created.
   * @param policy The policy address.
   * @param entity The entity which owns the policy.
   * @param deployer The person who deployed it.
   */
  event NewPolicy(
    address indexed policy,
    address indexed entity,
    address indexed deployer
  );
}

// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

/**
 * @dev Entity core logic.
 */
interface IEntitySimplePolicyCoreFacet {

  /**
   * @dev Create a new policy.
   *
   * `_stakeholders` and '_approvalSignatures'
   *    * Index 0: Broker entity address.
   *    * Index 1: Underwriter entity address.
   *    * Index 2: Claims admin entity address.
   *    * Index 3: Insured party entity address.
   *
   * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
   * @param _startDate Start Date.
   * @param _maturationDate Maturation Date.
   * @param _unit Unit.
   * @param _limit Limit.
   * @param _approvalSignatures Bulk-approval signatures in order: broker, underwriter, claims admin, insured party
   */
  function createSimplePolicy(
    bytes32 _id,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _limit,
    address[] calldata _stakeholders,
    bytes[] calldata _approvalSignatures
  ) external;

  /**
   * @dev Pay the next expected premium for a tranche using the assets owned by this entity.
   *
   * @param _id Policy which owns the tranche.
   * @param _amount Amount of premium to pay.
   */
  function paySimplePremium(bytes32 _id, address _entityAddress, uint256 _amount) external;
  
  /**
   * @dev Update Allow Simple Policy.
   *
   * @param _allow Allow.
   */
  function updateAllowSimplePolicy(bool _allow) external;

  /**
   * @dev Get simple policy info.
   *
   * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
   * @param _amount Amount to pay.
   */
  function paySimpleClaim (bytes32 _id, uint256 _amount) external payable;

  /**
   * @dev Heartbeat: Ensure the policy and tranche states are up-to-date.
   *
   * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
   */
  function checkAndUpdateState(bytes32 _id ) external;

  /**
   * @dev Update the collateral ratio and max capital for a given unit.
   */
  function updateEnabledCurrency(
    address _unit,
    uint256 _collateralRatio,
    uint256 _maxCapital
  )
  external;

}

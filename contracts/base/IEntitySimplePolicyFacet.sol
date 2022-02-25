// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

/**
 * @dev Entity core logic.
 */
interface IEntitySimplePolicyFacet {

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
   * @dev Emitted when a new policy has been created.
   * @param id The policy id.
   * @param entity The entity which owns the policy.
   */
  event NewSimplePolicy(
    bytes32 indexed id,
    address indexed entity
  );
  
  /**
   * @dev Update Allow Simple Policy.
   *
   * @param _allow Allow.
   */
  function updateAllowSimplePolicy(bool _allow) external;
  
  /**
   * @dev Get Allow Simple Policy.
   *
   */
  function allowSimplePolicy() external view returns (bool _allow);

  /**
   * @dev Get Number of Simple Policy.
   *
   */
  function getNumSimplePolicies() external view returns (uint256 _numPolicies);

  /**
   * @dev Get simple policy ID from policy number. Policy number is a sequential integer
   *
   * @param _policyNumber sequential integer
   */
  function getSimplePolicyId (uint256 _policyNumber) external view returns (bytes32 _id );

  /**
   * @dev Get simple policy info.
   *
   * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
   */
  function getSimplePolicyInfo (bytes32 _id) external view returns (
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 limit_,
    uint256 state_,
    uint256 premiumsPaid_,
    uint256 claimsPaid_
  );

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
  function checkAndUpdateState (bytes32 _id ) external;

  /**
   * @dev Verify simple policy.
   *
   * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
   */
  function verifySimplePolicy (bytes32 _id ) external;

  /**
   * @dev Get collateral ratio and max capital for given currency.
   * 
   * @param _unit unit
   */
  function getEnabledCurrency(address _unit) external view returns (uint256 _collateralRatio, uint256 _maxCapital);

  /**
   * @dev Get addresses of all the units/currencies
   */
  function getEnabledCurrencies() external view returns (address[] memory);

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

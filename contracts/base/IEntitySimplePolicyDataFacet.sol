// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;


/**
 * @dev Entity core logic.
 */
interface IEntitySimplePolicyDataFacet {

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
   * @dev Get simple policy ID for given policy number.
   */
  function getSimplePolicyId (uint256 _simplePolicyNumber) external view returns (bytes32 id_);

  /**
   * @dev Get premiums and claims paid totals.
   * @param _id Unique id that represents the policy.
   */
  function getPremiumsAndClaimsPaid(bytes32 _id) external view returns(uint256 premiumsPaid_, uint256 claimsPaid_);

  /**
   * @dev Get collateral ratio and max capital for given currency.
   *
   * @param _unit unit
   */
  function getEnabledCurrency(address _unit) external view returns (uint256 collateralRatio_, uint256 maxCapital_, uint256 totalLimit_);

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

  /**
   * @dev Get simple policy info.
   *
   * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
   * @param _amount Amount to pay.
   */
  function paySimpleClaim (bytes32 _id, uint256 _amount) external payable;

}

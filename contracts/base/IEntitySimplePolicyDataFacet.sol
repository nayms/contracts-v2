// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

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
   * @dev Get premiums and claims paid totals.
   * @param _id Unique id that represents the policy.
   */
  function getPremiumsAndClaimsPaid(bytes32 _id) external view returns(uint256 premiumsPaid_, uint256 claimsPaid_);

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

}
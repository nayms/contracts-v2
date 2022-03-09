// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
pragma experimental ABIEncoderV2;

/**
 * @dev Entity core logic.
 */
interface IEntityCoreFacet {
  /**
   * @dev Create a new policy.
   *
   * Some arguments are complex...
   *
   * `_typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP`
   *    * Index 0: Policy type, one of the `POLICY_TYPE_` constants.
   *    * Index 1: Time between successive premium payments (seconds).
   *    * Index 2: Initiation date (seconds since epoch).
   *    * Index 3: Start date (seconds since epoch).
   *    * Index 4: Maturation date (seconds since epoch).
   *    * Index 5: Broker commission basis points (1 = 0.01%)
   *    * Index 6: Underwriter commission basis points (1 = 0.01%)
   *    * Index 7: Claims admin commission basis points (1 = 0.01%)
   *    * Index 8: Nayms commission basis points (1 = 0.01%)
   *
   * `_unitAndTreasuryAndStakeholders`
   *    * Index 0: Policy premium currency.
   *    * Index 1: Treasury address.
   *    * Index 2: Broker entity address.
   *    * Index 3: Underwriter entity address.
   *    * Index 4: Claims admin entity address.
   *    * Index 5: Insured party entity address.
   *
   * `_trancheData`
   *    * This parameter is structured as follows. The outer array represents the list of tranches. The 
   *      inner array represents the `[ number of tranche shares, price per share, ...premium payment amounts ]`.
   *
   * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
   * @param _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP See above.
   * @param _unitAndTreasuryAndStakeholders See above.
   * @param _trancheData See above.
   * @param _approvalSignatures Bulk-approval signatures in order: broker, underwriter, claims admin, insured party
   */
  function createPolicy(
    bytes32 _id,
    uint256[] calldata _typeAndPremiumIntervalSecondsAndDatesAndCommissionsBP,
    address[] calldata _unitAndTreasuryAndStakeholders,
    uint256[][] calldata _trancheData,
    bytes[] calldata _approvalSignatures
  ) external;

  /**
   * @dev Pay the next expected premium for a tranche using the assets owned by this entity.
   *
   * @param _policy Policy which owns the tranche.
   * @param _trancheIndex Index of the tranche in the policy.
   * @param _amount Amount of premium to pay.
   */
  function payTranchePremium(address _policy, uint256 _trancheIndex, uint256 _amount) external;

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
  
  /**
   * @dev Update Allow Policy.
   *
   * @param _allow Allow.
   */
  function updateAllowPolicy(bool _allow) external;
  
  /**
   * @dev Get Allow Policy.
   *
   */
  function allowPolicy() external view returns (bool _allow);
  
}

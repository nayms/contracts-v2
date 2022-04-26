// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import { SimplePolicy, ISimplePolicy } from "../SimplePolicy.sol";

/**
 * @dev Entity core logic.
 */
interface IEntitySimplePolicyCoreFacet {
    
    /**
     * @dev Create a new policy.
     *
     * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
     * @param _startDate Start Date.
     * @param _maturationDate Maturation Date.
     * @param _unit Unit.
     * @param _limit Limit.
     * @param _stakeholders data about roles, stakeholder addresses and approval signatures and commissions.
     */
    function createSimplePolicy(
        bytes32 _id,
        uint256 _startDate,
        uint256 _maturationDate,
        address _unit,
        uint256 _limit,
        SimplePolicy.Stakeholders calldata _stakeholders
    ) external;

    /**
     * @dev Pay the next expected premium for a tranche using the assets owned by this entity.
     *
     * @param _id Policy which owns the tranche.
     * @param _amount Amount of premium to pay.
     */
    function paySimplePremium(
        bytes32 _id,
        address _entityAddress,
        uint256 _amount
    ) external;

    /**
     * @dev Update Allow Simple Policy.
     *
     * @param _allow Allow.
     */
    function updateAllowSimplePolicy(bool _allow) external;

    /**
     * @dev Heartbeat: Ensure the policy and tranche states are up-to-date.
     *
     * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
     */
    function checkAndUpdateState(bytes32 _id) external;
}

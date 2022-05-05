// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import { SimplePolicy, Stakeholders } from "../SimplePolicy.sol";
import "./ISimplePolicy.sol";

/**
 * @dev Core logic for Simple Policies.
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
        Stakeholders calldata _stakeholders
    ) external;

    /**
     * @dev Update Allow Simple Policy.
     *
     * @param _allow Allow.
     */
    function updateAllowSimplePolicy(bool _allow) external;
}

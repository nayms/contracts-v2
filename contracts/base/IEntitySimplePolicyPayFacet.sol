// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Entity Simple Policy payment operations.
 */
interface IEntitySimplePolicyPayFacet {
    /**
     * @dev Get simple policy info.
     *
     * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
     * @param _amount Amount to pay.
     */
    function paySimpleClaim(bytes32 _id, uint256 _amount) external payable;

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

    function paySimpleCommission() external;
}

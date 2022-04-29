// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import { EntityFacetBase, IERC20 } from "./EntityFacetBase.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IEntitySimplePolicyPayFacet.sol";
import "./base/ISimplePolicy.sol";

contract EntitySimplePolicyPayFacet is EntityFacetBase, IDiamondFacet, IEntitySimplePolicyPayFacet {
    constructor(address _settings) Controller(_settings) {}

    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(IEntitySimplePolicyPayFacet.paySimpleClaim.selector, IEntitySimplePolicyPayFacet.paySimplePremium.selector);
    }

    /**
     * @dev Performed by a nayms system manager and pays the insured party in the event of a claim.
     *
     * Semantically this method belongs to the EntitySimplePolicyCoreFacet along with
     * rest of the state mutating methods, but due to the contract size limitation
     * it had to be moved here.
     */
    function paySimpleClaim(bytes32 _id, uint256 _amount) external payable override assertIsSystemManager(msg.sender) {
        require(_amount > 0, "invalid claim amount");

        ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);

        address unit;
        uint256 limit;
        (, , , , unit, limit, ) = policy.getSimplePolicyInfo();

        uint256 claimsPaid = dataUint256[__a(unit, "claimsPaid")];

        require(limit >= _amount + claimsPaid, "exceeds policy limit");

        dataUint256[__a(unit, "claimsPaid")] += _amount;
        dataUint256[__a(unit, "balance")] -= _amount;

        // payout the insured party!
        address insured = acl().getUsersForRole(policy.aclContext(), ROLE_INSURED_PARTY)[0];
        IERC20(unit).transfer(insured, _amount);
    }

    function paySimplePremium(
        bytes32 _id,
        address _entityAddress,
        uint256 _amount
    ) external override {
        bytes32 entityCtx = AccessControl(_entityAddress).aclContext();
        require(acl().hasRoleInGroup(entityCtx, msg.sender, ROLEGROUP_ENTITY_REPS), "not an entity rep");

        require(_amount > 0, "invalid premium amount");

        ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);

        address unit;
        (, , , , unit, , ) = policy.getSimplePolicyInfo();

        dataUint256[__a(unit, "premiumsPaid")] += _amount;
        dataUint256[__a(unit, "balance")] += _amount;

        IERC20 token = IERC20(unit);
        token.approve(address(this), _amount);
        token.transferFrom(_entityAddress, address(policy), _amount);
    }

    function paySimpleCommission() external override {}
}

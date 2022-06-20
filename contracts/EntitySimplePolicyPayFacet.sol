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
        return abi.encodePacked(
            IEntitySimplePolicyPayFacet.paySimpleClaim.selector, 
            IEntitySimplePolicyPayFacet.paySimplePremium.selector,
            IEntitySimplePolicyPayFacet.payOutCommissions.selector
        );
    }

    function paySimpleClaim(bytes32 _id, uint256 _amount) external payable override assertIsSystemManager(msg.sender) {
        require(_amount > 0, "invalid claim amount");

        ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);

        address unit;
        uint256 limit;
        (, , , , unit, limit, , ) = policy.getSimplePolicyInfo();

        uint256 claimsPaid = dataUint256[__b(_id, "claimsPaid")];

        require(limit >= _amount + claimsPaid, "exceeds policy limit");

        dataUint256[__b(_id, "claimsPaid")] += _amount;
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

        uint256 netPremiumAmount = policy.takeCommissions(_amount);

        address unit;
        address treasury;
        (, , , , unit, , , treasury) = policy.getSimplePolicyInfo();

        dataUint256[__b(_id, "premiumsPaid")] += netPremiumAmount;
        dataUint256[__a(unit, "balance")] += netPremiumAmount;

        IERC20 token = IERC20(unit);
        token.approve(address(this), _amount);
        token.transferFrom(_entityAddress, treasury, _amount);
    }

    function payOutCommissions(bytes32 _id) external override {
        ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);
        
        uint256 brokerCommissionBalance;
        uint256 claimsAdminCommissionBalance;
        uint256 naymsCommissionBalance;
        uint256 underwriterCommissionBalance;
        (brokerCommissionBalance, claimsAdminCommissionBalance, naymsCommissionBalance, underwriterCommissionBalance) = policy.getCommissionBalances();
        
        address unit;
        address treasury;
        (, , , , unit, , , treasury) = policy.getSimplePolicyInfo();

        address underwriter_;
        address broker_;
        address claimsAdmin_;
        address feeBank_;
        (underwriter_, broker_, claimsAdmin_, feeBank_) = policy.getStakeholders();

        IERC20 tkn = IERC20(unit);

        if (brokerCommissionBalance > 0) {
            tkn.approve(address(this), brokerCommissionBalance);
            tkn.transferFrom(treasury, broker_, brokerCommissionBalance);
        }

        if (underwriterCommissionBalance > 0) {
            tkn.approve(address(this), underwriterCommissionBalance);
            tkn.transferFrom(treasury, underwriter_, underwriterCommissionBalance);
        }

        if (claimsAdminCommissionBalance > 0) {
            tkn.approve(address(this), claimsAdminCommissionBalance);
            tkn.transferFrom(treasury, claimsAdmin_, claimsAdminCommissionBalance);
        }

        if (naymsCommissionBalance > 0) {
            tkn.approve(address(this), naymsCommissionBalance);
            tkn.transferFrom(treasury, feeBank_, naymsCommissionBalance);
        }            
        
        // reset commission balances after paying them out
        policy.commissionsPayedOut();

    }
}

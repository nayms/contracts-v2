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
     * Semantically, this method belongs to the EntitySimplePolicyCoreFacet along with
     * rest of the state mutating methods, but due to the contract size limitation
     * it had to be moved here.
     */
    function paySimpleClaim(bytes32 _id, uint256 _amount) external payable override assertIsSystemManager(msg.sender) {
        require(_amount > 0, "invalid claim amount");

        ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);

        address unit;
        uint256 limit;
        (, , , , unit, limit, , ) = policy.getSimplePolicyInfo();

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
        address treasury;
        (, , , , unit, , , treasury) = policy.getSimplePolicyInfo();

        uint256 netPremiumAmount = _takeCommissions(_amount);

        dataUint256[__a(unit, "premiumsPaid")] += netPremiumAmount;
        dataUint256[__a(unit, "balance")] += netPremiumAmount;

        IERC20 token = IERC20(unit);
        token.approve(address(this), _amount);
        token.transferFrom(_entityAddress, treasury, _amount);
    }

    function _takeCommissions(uint256 _amount) private returns (uint256 netPremiumAmount_) {
        uint256 brokerCommission = (dataUint256["brokerCommissionBP"] * _amount) / 1000;
        uint256 underwriterCommission = (dataUint256["underwriterCommissionBP"] * _amount) / 1000;
        uint256 claimsAdminCommission = (dataUint256["claimsAdminCommissionBP"] * _amount) / 1000;
        uint256 naymsCommission = (dataUint256["naymsCommissionBP"] * _amount) / 1000;
        
        console.log("  --  amount: ", _amount);
        console.log("  --  brokerCommission", dataUint256["brokerCommissionBP"], brokerCommission);
        console.log("  --  underwriterCommission", dataUint256["underwriterCommissionBP"], underwriterCommission);
        console.log("  --  claimsAdminCommission", dataUint256["claimsAdminCommissionBP"], claimsAdminCommission);
        console.log("  --  naymsCommission", dataUint256["naymsCommissionBP"], naymsCommission);

        dataUint256["brokerCommissionBalance"] += brokerCommission;
        dataUint256["claimsAdminCommissionBalance"] += claimsAdminCommission;
        dataUint256["underwriterCommissionBalance"] += underwriterCommission;
        dataUint256["naymsCommissionBalance"] += naymsCommission;

        netPremiumAmount_ = _amount - brokerCommission - underwriterCommission - claimsAdminCommission - naymsCommission;
    }

    function paySimpleCommission() external override {
        address claimsAdmin = _getEntityWithRole(ROLE_CLAIMS_ADMIN);
        address broker = _getEntityWithRole(ROLE_BROKER);
        address underwriter = _getEntityWithRole(ROLE_UNDERWRITER);
        address feeBank = settings().getRootAddress(SETTING_FEEBANK);

        IERC20 tkn = IERC20(dataAddress["unit"]);

        if (dataUint256["brokerCommissionBalance"] > 0) {
            tkn.transferFrom(dataAddress["treasury"], broker, dataUint256["brokerCommissionBalance"]);
            dataUint256["brokerCommissionBalance"] = 0;
        }

        if (dataUint256["underwriterCommissionBalance"] > 0) {
            tkn.transferFrom(dataAddress["treasury"], underwriter, dataUint256["underwriterCommissionBalance"]);
            dataUint256["underwriterCommissionBalance"] = 0;
        }

        if (dataUint256["claimsAdminCommissionBalance"] > 0) {
            tkn.transferFrom(dataAddress["treasury"], claimsAdmin, dataUint256["claimsAdminCommissionBalance"]);
            dataUint256["claimsAdminCommissionBalance"] = 0;
        }

        if (dataUint256["naymsCommissionBalance"] > 0) {
            tkn.transferFrom(dataAddress["treasury"], feeBank, dataUint256["naymsCommissionBalance"]);
            dataUint256["naymsCommissionBalance"] = 0;
        }
    }

}

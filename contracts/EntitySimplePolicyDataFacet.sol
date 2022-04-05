// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import {EntityFacetBase, IERC20} from "./EntityFacetBase.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IEntitySimplePolicyDataFacet.sol";
import "./base/ISimplePolicy.sol";

contract EntitySimplePolicyDataFacet is EntityFacetBase, IDiamondFacet, IEntitySimplePolicyDataFacet {
    constructor(address _settings) Controller(_settings) {}

    function getSelectors() public pure override returns (bytes memory) {
        return
            abi.encodePacked(
                IEntitySimplePolicyDataFacet.allowSimplePolicy.selector,
                IEntitySimplePolicyDataFacet.getNumSimplePolicies.selector,
                IEntitySimplePolicyDataFacet.getSimplePolicyId.selector,
                IEntitySimplePolicyDataFacet.getPremiumsAndClaimsPaid.selector,
                IEntitySimplePolicyDataFacet.getEnabledCurrency.selector,
                IEntitySimplePolicyDataFacet.getEnabledCurrencies.selector,
                IEntitySimplePolicyDataFacet.updateEnabledCurrency.selector,
                IEntitySimplePolicyDataFacet.paySimpleClaim.selector
            );
    }

    function allowSimplePolicy() external view override returns (bool _allow) {
        return dataBool["allowSimplePolicy"];
    }

    function getNumSimplePolicies() external view override returns (uint256 _numPolicies) {
        return dataUint256["numSimplePolicies"];
    }

    function getSimplePolicyId(uint256 _simplePolicyNumber) external view override returns (bytes32 id_) {
        ISimplePolicy policy = ISimplePolicy(dataAddress[__i(_simplePolicyNumber, "addressByNumber")]);
        (id_, , , , , , ) = policy.getSimplePolicyInfo();
    }

    function getPremiumsAndClaimsPaid(bytes32 _id) external view override returns (uint256 premiumsPaid_, uint256 claimsPaid_) {
        ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);
        address unit;
        (, , , , unit, , ) = policy.getSimplePolicyInfo();

        premiumsPaid_ = dataUint256[__a(unit, "premiumsPaid")];
        claimsPaid_ = dataUint256[__a(unit, "claimsPaid")];
    }

    function getEnabledCurrencies() external view override returns (address[] memory) {
        return dataManyAddresses["enabledUnits"];
    }

    function getEnabledCurrency(address _unit)
        external
        view
        override
        returns (
            uint256 collateralRatio_,
            uint256 maxCapital_,
            uint256 totalLimit_
        )
    {
        collateralRatio_ = dataUint256[__a(_unit, "collateralRatio")];
        maxCapital_ = dataUint256[__a(_unit, "maxCapital")];
        totalLimit_ = dataUint256[__a(_unit, "totalLimit")];
    }

    /**
     * @dev Semantically this method belongs to the EntitySimplePolicyCoreFacet along with
     * rest of the state mutating methods, but due to the contract size limitation
     * it had to be moved here.
     */
    function updateEnabledCurrency(
        address _unit,
        uint256 _collateralRatio,
        uint256 _maxCapital
    ) external override assertIsSystemManager(msg.sender) {
        bool hasUnit = false;
        address[] memory newUnits;
        uint256 unitIndex = 0;

        if (_collateralRatio == 0 && _maxCapital == 0) {
            // remove unit
            for (uint256 j = 0; j < dataManyAddresses["enabledUnits"].length; j += 1) {
                if (dataManyAddresses["enabledUnits"][j] != _unit) {
                    newUnits[unitIndex] = dataManyAddresses["enabledUnits"][j];
                    unitIndex++;
                }
            }
            dataManyAddresses["enabledUnits"] = newUnits;
        }
        // add or update unit
        else {
            if (_collateralRatio > 1000) {
                revert("collateral ratio is 0-1000");
            }

            for (uint256 j = 0; j < dataManyAddresses["enabledUnits"].length; j += 1) {
                if (dataManyAddresses["enabledUnits"][j] == _unit) {
                    hasUnit = true;
                    break;
                }
            }
            if (!hasUnit) {
                dataManyAddresses["enabledUnits"].push(_unit);
            }
        }

        //Either way, update the values
        dataUint256[__a(_unit, "maxCapital")] = _maxCapital;
        dataUint256[__a(_unit, "collateralRatio")] = _collateralRatio;
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
}

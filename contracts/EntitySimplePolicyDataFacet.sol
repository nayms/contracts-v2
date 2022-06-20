// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import { EntityFacetBase, IERC20 } from "./EntityFacetBase.sol";
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
                IEntitySimplePolicyDataFacet.checkAndUpdateState.selector
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
        (id_, , , , , , , ) = policy.getSimplePolicyInfo();
    }

    function getPremiumsAndClaimsPaid(bytes32 _id) external view override returns (uint256 premiumsPaid_, uint256 claimsPaid_) {
        premiumsPaid_ = dataUint256[__b(_id, "premiumsPaid")];
        claimsPaid_ = dataUint256[__b(_id, "claimsPaid")];
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

        if (_collateralRatio == 0 && _maxCapital == 0) {
            // remove unit
            uint256 unitIndex = 0;
            address[] memory newUnits = new address[](dataManyAddresses["enabledUnits"].length - 1);

            for (uint256 j = 0; j < dataManyAddresses["enabledUnits"].length; j++) {
                if (dataManyAddresses["enabledUnits"][j] != _unit) {
                    newUnits[unitIndex++] = dataManyAddresses["enabledUnits"][j];
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

    function checkAndUpdateState(bytes32 _id) external override {
        ISimplePolicy policy = ISimplePolicy(dataAddress[__b(_id, "addressById")]);

        bool reduceTotalLimit = policy.checkAndUpdateState();

        if (reduceTotalLimit) {
            address unit;
            uint256 limit;
            (, , , , unit, limit, , ) = policy.getSimplePolicyInfo();

            dataUint256[__a(unit, "totalLimit")] -= limit;
        }
    }
}

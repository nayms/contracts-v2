// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./SimplePolicyFacetBase.sol";
import "./base/ISimplePolicyCommissionsFacet.sol";
import { IERC20 } from "./EntityFacetBase.sol";

contract SimplePolicyCommissionsFacet is EternalStorage, Controller, IDiamondFacet, ISimplePolicyCommissionsFacet, SimplePolicyFacetBase {
    constructor(address _settings) Controller(_settings) {
        // nothing to do here
    }

    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(
          ISimplePolicyCommissionsFacet.getCommissionRates.selector,
          ISimplePolicyCommissionsFacet.getCommissionBalances.selector,
          ISimplePolicyCommissionsFacet.takeCommissions.selector,
          ISimplePolicyCommissionsFacet.commissionsPayedOut.selector,
          ISimplePolicyCommissionsFacet.getStakeholders.selector
          );
    }

    function getCommissionRates()
        external
        view
        override
        returns (
            uint256 brokerCommissionBP_,
            uint256 claimsAdminCommissionBP_,
            uint256 naymsCommissionBP_,
            uint256 underwriterCommissionBP_
        ) {
            brokerCommissionBP_ = dataUint256["brokerCommissionBP"];
            claimsAdminCommissionBP_ = dataUint256["claimsAdminCommissionBP"];
            naymsCommissionBP_ = dataUint256["naymsCommissionBP"];
            underwriterCommissionBP_ = dataUint256["underwriterCommissionBP"];
        }

    function getCommissionBalances()
        external
        view
        override
        returns (
            uint256 brokerCommissionBalance_,
            uint256 claimsAdminCommissionBalance_,
            uint256 naymsCommissionBalance_,
            uint256 underwriterCommissionBalance_
        )
    {
        brokerCommissionBalance_ = dataUint256["brokerCommissionBalance"];
        claimsAdminCommissionBalance_ = dataUint256["claimsAdminCommissionBalance"];
        naymsCommissionBalance_ = dataUint256["naymsCommissionBalance"];
        underwriterCommissionBalance_ = dataUint256["underwriterCommissionBalance"];
    }

    function takeCommissions(uint256 _amount) external override returns (uint256 netPremiumAmount_) {
        uint256 brokerCommission = (dataUint256["brokerCommissionBP"] * _amount) / 1000;
        uint256 underwriterCommission = (dataUint256["underwriterCommissionBP"] * _amount) / 1000;
        uint256 claimsAdminCommission = (dataUint256["claimsAdminCommissionBP"] * _amount) / 1000;
        uint256 naymsCommission = (dataUint256["naymsCommissionBP"] * _amount) / 1000;

        dataUint256["brokerCommissionBalance"] += brokerCommission;
        dataUint256["underwriterCommissionBalance"] += underwriterCommission;
        dataUint256["claimsAdminCommissionBalance"] += claimsAdminCommission;
        dataUint256["naymsCommissionBalance"] += naymsCommission;

        netPremiumAmount_ = _amount - brokerCommission - underwriterCommission - claimsAdminCommission - naymsCommission;
    }

    function commissionsPayedOut() external override {
        if (dataUint256["brokerCommissionBalance"] > 0) {
            dataUint256["brokerCommissionBalance"] = 0;
        }

        if (dataUint256["underwriterCommissionBalance"] > 0) {
            dataUint256["underwriterCommissionBalance"] = 0;
        }

        if (dataUint256["claimsAdminCommissionBalance"] > 0) {
            dataUint256["claimsAdminCommissionBalance"] = 0;
        }

        if (dataUint256["naymsCommissionBalance"] > 0) {
            dataUint256["naymsCommissionBalance"] = 0;
        }
    }

    function getStakeholders() external view override
        returns (
            address broker_,
            address underwriter_,
            address claimsAdmin_,
            address feeBank_
        ) {
        broker_ = _getEntityWithRole(ROLE_BROKER);
        underwriter_ = _getEntityWithRole(ROLE_UNDERWRITER);
        claimsAdmin_ = _getEntityWithRole(ROLE_CLAIMS_ADMIN);
        feeBank_ = settings().getRootAddress(SETTING_FEEBANK);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./base/EternalStorage.sol";
import "./base/ECDSA.sol";
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
          ISimplePolicyCommissionsFacet.getCommissionBalances.selector,
          ISimplePolicyCommissionsFacet.takeCommissions.selector,
          ISimplePolicyCommissionsFacet.payCommissions.selector
          );
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

    function payCommissions() external payable override {
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

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "../base/IDiamondFacet.sol";
import "../base/IEntityCoreFacet.sol";
import "../base/IEntityFundingFacet.sol";
import "../base/IEntitySimplePolicyCoreFacet.sol";
import "../base/IEntitySimplePolicyDataFacet.sol";
import "../base/IEntitySimplePolicyPayFacet.sol";
import { ISimplePolicy } from "../base/ISimplePolicy.sol";

contract DummyEntityFacet is IDiamondFacet, IEntityCoreFacet, IEntityFundingFacet, IEntitySimplePolicyCoreFacet, IEntitySimplePolicyDataFacet, IEntitySimplePolicyPayFacet {
    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(IEntityFundingFacet.getBalance.selector);
    }

    function getBalance(
        address /*_unit*/
    ) public view override returns (uint256) {
        return 123;
    }

    function createPolicy(
        bytes32 _id,
        uint256[] calldata _typeAndDatesAndCommissionsBP,
        address[] calldata _unitAndTreasuryAndStakeholders,
        uint256[][] calldata _trancheData,
        bytes[] calldata _approvalSignatures
    ) external override {}

    function deposit(address _unit, uint256 _amount) external override {}

    function withdraw(address _unit, uint256 _amount) external override {}

    function payTranchePremium(
        address _policy,
        uint256 _trancheIndex,
        uint256 _amount
    ) external override {}

    function trade(
        address _payUnit,
        uint256 _payAmount,
        address _buyUnit,
        uint256 _buyAmount
    ) external override returns (uint256) {}

    function cancelOffer(uint256 _offerId) external {}

    function sellAtBestPrice(
        address _sellUnit,
        uint256 _sellAmount,
        address _buyUnit
    ) external override {}

    function updateEnabledCurrency(
        address _unit,
        uint256 _collateralRatio,
        uint256 _maxCapital
    ) external override {}

    function getEnabledCurrency(address _unit)
        external
        view
        override
        returns (
            uint256 collateralRatio_,
            uint256 maxCapital_,
            uint256 totalLimit_
        )
    {}

    function getEnabledCurrencies() external view override returns (address[] memory) {}

    function updateAllowPolicy(bool _allow) external override {}

    function allowPolicy() external view override returns (bool _allow) {}

    function createSimplePolicy(
        bytes32 _id,
        uint256 _startDate,
        uint256 _maturationDate,
        address _unit,
        uint256 _limit,
        ISimplePolicy.StakeholdersData calldata _stakeholders
    ) external override {}

    function paySimplePremium(
        bytes32 _id,
        address _entityAddress,
        uint256 _amount
    ) external override {}

    function updateAllowSimplePolicy(bool _allow) external override {}

    function allowSimplePolicy() external view override returns (bool _allow) {}

    function getNumSimplePolicies() external view override returns (uint256 _numPolicies) {}

    function getSimplePolicyId(uint256 _simplePolicyNumber) external view override returns (bytes32 id_) {}

    function paySimpleClaim(bytes32 _id, uint256 _amount) external payable override {}

    function checkAndUpdateState(bytes32 _id) external override {}

    function getPremiumsAndClaimsPaid(bytes32 _id) external view override returns (uint256 premiumsPaid_, uint256 claimsPaid_) {}

    function getCommissionBalances()
        external
        view
        returns (
            uint256 brokerCommissionBalance_,
            uint256 claimsAdminCommissionBalance_,
            uint256 naymsCommissionBalance_,
            uint256 underwriterCommissionBalance_
        )
    {}

    function payOutCommissions(bytes32 _id) external {}
}

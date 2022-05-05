// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

interface ISimplePolicyCommissionsFacet {
    function getCommissionBalances()
        external
        view
        returns (
            uint256 brokerCommissionBalance_,
            uint256 claimsAdminCommissionBalance_,
            uint256 naymsCommissionBalance_,
            uint256 underwriterCommissionBalance_
        );

    function takeCommissions(uint256 _amount) external returns (uint256 netPremiumAmount_);

    function payCommissions() external payable;
}

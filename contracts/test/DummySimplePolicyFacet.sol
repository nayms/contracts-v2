// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "../base/IDiamondFacet.sol";
import "../base/ISimplePolicyApprovalsFacet.sol";
import "../base/ISimplePolicyCommissionsFacet.sol";
import "../base/ISimplePolicyHeartbeatFacet.sol";

contract DummySimplePolicyFacet is IDiamondFacet, ISimplePolicyApprovalsFacet, ISimplePolicyCommissionsFacet, ISimplePolicyHeartbeatFacet {
    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(ISimplePolicyHeartbeatFacet.checkAndUpdateState.selector);
    }

    function approveSimplePolicy(bytes32[] memory _roles, bytes[] memory _signatures) external {}

    function checkAndUpdateState() external override returns (bool reduceTotalLimit_) {}

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

    function takeCommissions(uint256 _amount) external returns (uint256 netPremiumAmount_) {}

    function commissionsPayedOut() external {}

    function getStakeholders()
        external
        view
        override
        returns (
            address broker_,
            address underwriter_,
            address claimsAdmin_,
            address feeBank_
        )
    {}

    function getCommissionRates()
        external
        view
        override
        returns (
            uint256 brokerCommissionBP_,
            uint256 claimsAdminCommissionBP_,
            uint256 naymsCommissionBP_,
            uint256 underwriterCommissionBP_
        )
    {}
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IChild.sol";
import "./ISimplePolicyStates.sol";
import "./ISimplePolicyApprovalsFacet.sol";
import "./ISimplePolicyCommissionsFacet.sol";
import "./ISimplePolicyHeartbeatFacet.sol";

/**
 * @dev Super-interface for Simple Policies
 */
abstract contract ISimplePolicy is
    IDiamondUpgradeFacet,
    IAccessControl,
    ISettingsControl,
    IChild,
    ISimplePolicyStates,
    ISimplePolicyApprovalsFacet,
    ISimplePolicyCommissionsFacet,
    ISimplePolicyHeartbeatFacet
{
    struct StakeholdersData {
        bytes32[] roles;
        address[] stakeholdersAddresses;
        bytes[] approvalSignatures;
        uint256[] commissions; // always has one element more than roles, for nayms treasury
    }

    /**
     * @dev Get simple policy info.
     */
    function getSimplePolicyInfo()
        external
        view
        virtual
        returns (
            bytes32 id_,
            uint256 number_,
            uint256 startDate_,
            uint256 maturationDate_,
            address unit_,
            uint256 limit_,
            uint256 state_,
            address treasury_
        );
}

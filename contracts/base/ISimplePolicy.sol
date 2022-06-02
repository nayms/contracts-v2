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

    struct Stakeholders {
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

    /**
     * @dev Heartbeat: Ensure the policy and tranche states are up-to-date.
     *
     */
    function checkAndUpdateState() external virtual returns (bool reduceTotalLimit_);

    //   /**
    //  * @dev Verify simple policy.
    //  *
    //  * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
    //  */
    // function verifySimplePolicy (bytes32 _id ) external;

    /**
     * @dev take commissions for the premium paid
     *
     * @param _amount total premium amount paid
     */
    function takeCommissions(uint256 _amount) external virtual returns (uint256 netPremiumAmount_);

    /**
     * @dev Get the commission balances for the simple policy.
     */
    function getCommissionBalances()
        external
        view
        virtual
        returns (
            uint256 brokerCommissionBalance_,
            uint256 claimsAdminCommissionBalance_,
            uint256 naymsCommissionBalance_,
            uint256 underwriterCommissionBalance_
        );

    function payCommissions() external payable virtual;
}

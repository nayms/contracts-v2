// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

// import "./IDiamondUpgradeFacet.sol";
// import "./IAccessControl.sol";
// import "./ISettingsControl.sol";
// import "./ISimplePolicyStates.sol";

/**
 * @dev Interface for simple policies
 */
interface ISimplePolicy2 {
    /**
     * @dev Get simple policy info.
     *
     */
    function getSimplePolicyInfo()
        external
        view
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
     * @dev Emitted when a new policy has been created.
     * @param id The policy id.
     * @param simplePolicy The policy address.
     */
    event NewSimplePolicy(bytes32 indexed id, address indexed simplePolicy);

    /**
     * @dev Heartbeat: Ensure the policy and tranche states are up-to-date.
     *
     */
    function checkAndUpdateState() external returns (bool reduceTotalLimit_);

    //   /**
    //  * @dev Verify simple policy.
    //  *
    //  * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
    //  */
    // function verifySimplePolicy (bytes32 _id ) external;
    function approveSimplePolicy(bytes32[] memory _roles, bytes[] memory _signatures) external;

    function getCommissionBalances()
        external
        view
        returns (
            uint256 brokerCommissionBalance_,
            uint256 claimsAdminCommissionBalance_,
            uint256 naymsCommissionBalance_,
            uint256 underwriterCommissionBalance_
        );    
}

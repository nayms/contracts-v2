// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./ISimplePolicyStates.sol";

/**
 * @dev Super-interface for simple policies
 */
abstract contract ISimplePolicy is IAccessControl {

    /**
     * @dev Get simple policy info.
     *
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
            uint256 state_
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
    function checkAndUpdateState() external virtual returns (bool reduceTotalLimit_);

    //   /**
    //  * @dev Verify simple policy.
    //  *
    //  * @param _id Unique id that represents the policy - this is what stakeholder will sign to approve the policy.
    //  */
    // function verifySimplePolicy (bytes32 _id ) external;
}

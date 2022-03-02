// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

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
  function getSimplePolicyInfo() external virtual view returns (
    uint256 startDate_,
    uint256 maturationDate_,
    address unit_,
    uint256 limit_,
    uint256 state_
  );

  /**
   * @dev Emitted when a new policy has been created.
   * @param id The policy id.
   * @param entity The entity which owns the policy.
   */
  event NewSimplePolicy(
    bytes32 indexed id,
    address indexed entity
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
}

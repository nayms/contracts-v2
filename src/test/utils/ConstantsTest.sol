// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/// @dev pre-evaluate constants to save gas? Or will the compiler know to do this when deployed?
/// compiler should do this in newer versions
contract ConstantsTest {
    // roles
    bytes32 public constant APPROVED_USER = keccak256("ROLE_APPROVED_USER");

    // role groups
    bytes32 public constant APPROVED_USERS = keccak256("ROLEGROUP_APPROVED_USERS");

    // settings
    bytes32 public constant S_MARKET = keccak256("SETTING_MARKET");

    // for tests
    bytes32 public constant R1 = keccak256("test_role_1");
    bytes32 public constant R2 = keccak256("R2");
    bytes32 public constant R3 = keccak256("R3");

    bytes32 public constant G1 = keccak256("test_group_1");
    bytes32 public constant G2 = keccak256("test_group_2");

    bytes32 public constant RG1 = keccak256("test_roleGroup1");
    bytes32 public constant RG2 = keccak256("roleGroup2");
    bytes32 public constant RG3 = keccak256("roleGroup3");

    bytes32 public constant C1 = keccak256("test_context_1");
    bytes32 public constant C2 = keccak256("test2");
    bytes32 public constant C3 = keccak256("test3");

    bytes32 public constant S1 = keccak256("test_settings_1");
}

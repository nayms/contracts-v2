// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

abstract contract IPolicyTreasuryConstants {
    bytes32 public constant ORDER_TYPE_TOKEN_SALE = 0xfca7e79cb5091f353eb60204c9aee8a98531c6069472e235576044613bd73961;
    bytes32 public constant ORDER_TYPE_TOKEN_BUYBACK = 0x54727092b015b3d280c3e42726b5e6008f8b85c202d92feae67d30b486fc630f;

    /**
     * @dev Emitted when policy balance is updated.
     * @param policy The policy address.
     * @param newBal The new balance.
     */
    event UpdatePolicyBalance(address indexed policy, uint256 indexed newBal);

    /**
     * @dev Emitted when the minimum expected policy balance gets set.
     * @param policy The policy address.
     * @param bal The balance.
     */
    event SetMinPolicyBalance(address indexed policy, uint256 indexed bal);
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import { IACLConstants } from "../../../../contracts/base/IACLConstants.sol";
import { ACL } from "../../../../contracts/ACL.sol";
import { Settings } from "../../../../contracts/Settings.sol";

contract NaymsMock is IACLConstants, ACL, Settings {
    ACL public aclc;

    constructor() ACL(ROLE_SYSTEM_ADMIN, ROLEGROUP_SYSTEM_ADMINS) Settings(address(aclc)) {}
}

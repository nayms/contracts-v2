// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IPolicyCoreFacet.sol";
import "./IPolicyClaimsFacet.sol";
import "./IChild.sol";
import "./IPolicyCommissionsFacet.sol";
import "./IPolicyPremiumsFacet.sol";
import "./IPolicyTrancheTokensFacet.sol";
import "./IPolicyApprovalsFacet.sol";
import "./IPolicyStates.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IPolicy is
    IDiamondUpgradeFacet,
    IAccessControl,
    ISettingsControl,
    IChild,
    IPolicyStates,
    IPolicyCoreFacet,
    IPolicyClaimsFacet,
    IPolicyCommissionsFacet,
    IPolicyPremiumsFacet,
    IPolicyTrancheTokensFacet,
    IPolicyApprovalsFacet
{

}

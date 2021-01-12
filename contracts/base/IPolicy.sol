pragma solidity >=0.6.7;

import "./IDiamondUpgradeFacet.sol";
import "./IAccessControl.sol";
import "./ISettingsControl.sol";
import "./IPolicyCoreFacet.sol";
import "./IPolicyClaimsFacet.sol";
import "./IPolicyCommissionsFacet.sol";
import "./IPolicyPremiumsFacet.sol";
import "./IPolicyTranchTokensFacet.sol";
import "./IPolicyApprovalsFacet.sol";
import "./IPolicyStates.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IPolicy is
  IDiamondUpgradeFacet,
  IAccessControl,
  ISettingsControl,
  IPolicyStates,
  IPolicyCoreFacet,
  IPolicyClaimsFacet,
  IPolicyCommissionsFacet,
  IPolicyPremiumsFacet,
  IPolicyTranchTokensFacet,
  IPolicyApprovalsFacet
  {}

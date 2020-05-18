pragma solidity >=0.6.7;

import "./IPolicyCoreFacet.sol";
import "./IPolicyClaimsFacet.sol";
import "./IPolicyCommissionsFacet.sol";
import "./IPolicyPremiumsFacet.sol";
import "./IPolicyTranchTokensFacet.sol";
import "./IPolicyStates.sol";

/**
 * @dev Super-interface for entities
 */
abstract contract IPolicy is
  IPolicyCoreFacet,
  IPolicyClaimsFacet,
  IPolicyCommissionsFacet,
  IPolicyPremiumsFacet,
  IPolicyTranchTokensFacet,
  IPolicyStates
  {}

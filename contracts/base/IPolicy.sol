pragma solidity >=0.6.7;

import "./IPolicyCore.sol";
import "./IPolicyClaims.sol";
import "./IPolicyCommissions.sol";
import "./IPolicyPremiums.sol";
import "./IPolicyTranchTokens.sol";

/**
 * @dev Super-interface for entities
 */
interface IPolicy is IPolicyCore, IPolicyClaims, IPolicyCommissions, IPolicyPremiums, IPolicyTranchTokens {}

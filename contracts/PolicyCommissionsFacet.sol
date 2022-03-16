// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyCommissionsFacet.sol";
import ".//PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";
import "./base/ReentrancyGuard.sol";

/**
 * @dev Business-logic for Policy commissions
 */
contract PolicyCommissionsFacet is EternalStorage, Controller, IDiamondFacet, IPolicyCommissionsFacet, PolicyFacetBase, ReentrancyGuard {
  modifier assertPolicyApproved () {
    uint256 state = dataUint256["state"];
    require(state != POLICY_STATE_IN_APPROVAL && state != POLICY_STATE_CREATED, 'must be approved');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyCommissionsFacet.payCommissions.selector,
      IPolicyCommissionsFacet.getCommissionBalances.selector,
      IPolicyCommissionsFacet.getCommissionRates.selector
    );
  }

  // IPolicyCommissionsFacet

  function getCommissionRates() external view override returns (
    uint256 brokerCommissionBP_,
    uint256 claimsAdminCommissionBP_,
    uint256 naymsCommissionBP_,
    uint256 underwriterCommissionBP_
  ) {
    brokerCommissionBP_ = dataUint256["brokerCommissionBP"];
    claimsAdminCommissionBP_ = dataUint256["claimsAdminCommissionBP"];
    naymsCommissionBP_ = dataUint256["naymsCommissionBP"];
    underwriterCommissionBP_ = dataUint256["underwriterCommissionBP"];
  }

  function getCommissionBalances() external view override returns (
    uint256 brokerCommissionBalance_,
    uint256 claimsAdminCommissionBalance_,
    uint256 naymsCommissionBalance_,
    uint256 underwriterCommissionBalance_
  ) {
    brokerCommissionBalance_ = dataUint256["brokerCommissionBalance"];
    claimsAdminCommissionBalance_ = dataUint256["claimsAdminCommissionBalance"];
    naymsCommissionBalance_ = dataUint256["naymsCommissionBalance"];
    underwriterCommissionBalance_ = dataUint256["underwriterCommissionBalance"];
  }


  function payCommissions ()
    public
    override
    nonReentrant
    assertPolicyApproved
  {
    address claimsAdmin = _getEntityWithRole(ROLE_CLAIMS_ADMIN);
    address broker = _getEntityWithRole(ROLE_BROKER);
    address underwriter = _getEntityWithRole(ROLE_UNDERWRITER);
    address feeBank = settings().getRootAddress(SETTING_FEEBANK);

    // do payouts and update balances
    IERC20 tkn = IERC20(dataAddress["unit"]);

    if (dataUint256["claimsAdminCommissionBalance"] > 0) {
      tkn.transfer(claimsAdmin, dataUint256["claimsAdminCommissionBalance"]);
      dataUint256["claimsAdminCommissionBalance"] = 0;
    }
  
    if (dataUint256["brokerCommissionBalance"] > 0) {
      tkn.transfer(broker, dataUint256["brokerCommissionBalance"]);
      dataUint256["brokerCommissionBalance"] = 0;
    }

    if (dataUint256["naymsCommissionBalance"] > 0) {
      tkn.transfer(feeBank, dataUint256["naymsCommissionBalance"]);
      dataUint256["naymsCommissionBalance"] = 0;
    }

    if (dataUint256["underwriterCommissionBalance"] > 0) {
      tkn.transfer(underwriter, dataUint256["underwriterCommissionBalance"]);
      dataUint256["underwriterCommissionBalance"] = 0;
    }

    emit PaidCommissions(claimsAdmin, broker, underwriter);
  }
}

pragma solidity >=0.6.7;

import "./base/SafeMath.sol";
import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IPolicyPremiumsFacet.sol";
import "./base/PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Policy premiums
 */
contract PolicyPremiumsFacet is EternalStorage, Controller, IDiamondFacet, IPolicyPremiumsFacet, PolicyFacetBase {
  using SafeMath for uint;

  modifier assertTranchPaymentAllowed (uint256 _index) {
    uint256 _tranchState = dataUint256[__i(_index, "state")];
    require(_tranchState != TRANCH_STATE_CANCELLED && _tranchState != TRANCH_STATE_MATURED, 'payment not allowed');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyPremiumsFacet.getTranchPremiumInfo.selector,
      IPolicyPremiumsFacet.payTranchPremium.selector
    );
  }

  // IPolicyPremiumsFacet

  function getTranchPremiumInfo (uint256 _tranchIndex, uint256 _premiumIndex) public view override returns (
    uint256 amount_,
    uint256 dueAt_,
    uint256 paidAt_,
    address paidBy_
  ) {
    amount_ = dataUint256[__ii(_tranchIndex, _premiumIndex, "premiumAmount")];
    dueAt_ = dataUint256[__ii(_tranchIndex, _premiumIndex, "premiumDueAt")];
    paidAt_ = dataUint256[__ii(_tranchIndex, _premiumIndex, "premiumPaidAt")];
    paidBy_ = dataAddress[__ii(_tranchIndex, _premiumIndex, "premiumPaidBy")];
  }

  function payTranchPremium (uint256 _index) public override {
    IPolicyCoreFacet(address(this)).checkAndUpdateState();
    _payTranchPremium(_index);
  }

  // Internal methods

  function _payTranchPremium (uint256 _index) private assertTranchPaymentAllowed(_index) {
    require(!_tranchPaymentsAllMade(_index), 'all payments already made');

    uint256 expectedAmount;
    uint256 expectedAt;

    (expectedAmount, expectedAt) = _getNextTranchPremium(_index);

    require(expectedAt >= now, 'payment too late');

    // transfer
    IERC20 tkn = IERC20(dataAddress["unit"]);
    tkn.transferFrom(msg.sender, address(this), expectedAmount);

    // record the payments
    uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];
    dataUint256[__i(_index, "numPremiumsPaid")] = numPremiumsPaid + 1;
    dataUint256[__ii(_index, numPremiumsPaid, "premiumPaidAt")] = now;
    dataAddress[__ii(_index, numPremiumsPaid, "premiumPaidBy")] = msg.sender;

    // calculate commissions
    uint256 brokerCommission = dataUint256["brokerCommissionBP"].mul(expectedAmount).div(1000);
    uint256 assetManagerCommission = dataUint256["assetManagerCommissionBP"].mul(expectedAmount).div(1000);
    uint256 naymsCommission = dataUint256["naymsCommissionBP"].mul(expectedAmount).div(1000);

    // add to commission balances
    dataUint256["brokerCommissionBalance"] = dataUint256["brokerCommissionBalance"].add(brokerCommission);
    dataUint256["assetManagerCommissionBalance"] = dataUint256["assetManagerCommissionBalance"].add(assetManagerCommission);
    dataUint256["naymsCommissionBalance"] = dataUint256["naymsCommissionBalance"].add(naymsCommission);

    // add to tranch balance
    uint256 tranchBalanceDelta = expectedAmount.sub(brokerCommission.add(assetManagerCommission).add(naymsCommission));
    dataUint256[__i(_index, "balance")] = dataUint256[__i(_index, "balance")].add(tranchBalanceDelta);

    emit PremiumPayment(_index, expectedAmount, msg.sender);
  }

  function _getNextTranchPremium (uint256 _index) private view returns (uint256, uint256) {
    uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];

    return (
      dataUint256[__ii(_index, numPremiumsPaid, "premiumAmount")],
      dataUint256[__ii(_index, numPremiumsPaid, "premiumDueAt")]
    );
  }

  function _tranchPaymentsAllMade (uint256 _index) private view returns (bool) {
    uint256 numPremiums = dataUint256[__i(_index, "numPremiums")];
    uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];
    return (numPremiumsPaid == numPremiums);
  }
}

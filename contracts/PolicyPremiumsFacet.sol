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
  constructor (address _settings) Controller(_settings) public {
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
    uint256 paidSoFar_,
    uint256 fullyPaidAt_
  ) {
    amount_ = dataUint256[__ii(_tranchIndex, _premiumIndex, "premiumAmount")];
    dueAt_ = dataUint256[__ii(_tranchIndex, _premiumIndex, "premiumDueAt")];
    paidSoFar_ = dataUint256[__ii(_tranchIndex, _premiumIndex, "premiumPaidSoFar")];
    fullyPaidAt_ = dataUint256[__ii(_tranchIndex, _premiumIndex, "premiumPaidAt")];
  }

  function payTranchPremium (uint256 _index, uint256 _amount) public override {
    IPolicyCoreFacet(address(this)).checkAndUpdateState();
    _payTranchPremium(_index, _amount);
  }

  // Internal methods

  function _payTranchPremium (uint256 _index, uint256 _amount) private assertTranchPaymentAllowed(_index) {
    uint256 totalPaid;
    uint256 netPremium;

    while (_amount > 0 && !_tranchPaymentsAllMade(_index)) {
      uint256 expectedAmount;
      uint256 expectedAt;
      uint256 paidSoFar;

      (expectedAmount, expectedAt, paidSoFar) = _getNextTranchPremium(_index);

      require(expectedAt >= now, 'payment too late');

      uint256 pending = expectedAmount.sub(paidSoFar);

      uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];

      if (_amount >= pending) {
        netPremium += _applyPremiumPaymentAmount(_index, pending);
        totalPaid = totalPaid.add(pending);
        _amount = _amount.sub(pending);

        dataUint256[__i(_index, "numPremiumsPaid")] = numPremiumsPaid + 1;
        dataUint256[__ii(_index, numPremiumsPaid, "premiumPaidAt")] = now;
        dataUint256[__ii(_index, numPremiumsPaid, "premiumPaidSoFar")] = dataUint256[__ii(_index, numPremiumsPaid, "premiumAmount")];
      } else {
        netPremium += _applyPremiumPaymentAmount(_index, _amount);
        totalPaid = totalPaid.add(_amount);
        dataUint256[__ii(_index, numPremiumsPaid, "premiumPaidSoFar")] = dataUint256[__ii(_index, numPremiumsPaid, "premiumPaidSoFar")].add(_amount);
        _amount = 0;
      }
    }

    // do the actual transfer to the treasury
    IERC20 tkn = IERC20(dataAddress["unit"]);
    uint256 totalCommissions = totalPaid - netPremium;
    tkn.transferFrom(msg.sender, address(this), totalCommissions);
    tkn.transferFrom(msg.sender, dataAddress["treasury"], netPremium);
    
    // event
    emit PremiumPayment(_index, totalPaid, msg.sender);
  }

  function _applyPremiumPaymentAmount (uint256 _index, uint256 _amount) private returns (uint256) {
    // calculate commissions
    uint256 brokerCommission = dataUint256["brokerCommissionBP"].mul(_amount).div(1000);
    uint256 claimsAdminCommission = dataUint256["claimsAdminCommissionBP"].mul(_amount).div(1000);
    uint256 naymsCommission = dataUint256["naymsCommissionBP"].mul(_amount).div(1000);

    // add to commission balances
    dataUint256["brokerCommissionBalance"] = dataUint256["brokerCommissionBalance"].add(brokerCommission);
    dataUint256["claimsAdminCommissionBalance"] = dataUint256["claimsAdminCommissionBalance"].add(claimsAdminCommission);
    dataUint256["naymsCommissionBalance"] = dataUint256["naymsCommissionBalance"].add(naymsCommission);

    // add to tranch balance
    uint256 tranchBalanceDelta = _amount.sub(brokerCommission.add(claimsAdminCommission).add(naymsCommission));
    dataUint256[__i(_index, "balance")] = dataUint256[__i(_index, "balance")].add(tranchBalanceDelta);

    return tranchBalanceDelta;
  }

  function _getNextTranchPremium (uint256 _index) private view returns (uint256, uint256, uint256) {
    uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];

    return (
      dataUint256[__ii(_index, numPremiumsPaid, "premiumAmount")],
      dataUint256[__ii(_index, numPremiumsPaid, "premiumDueAt")],
      dataUint256[__ii(_index, numPremiumsPaid, "premiumPaidSoFar")]
    );
  }

  function _tranchPaymentsAllMade (uint256 _index) private view returns (bool) {
    uint256 numPremiums = dataUint256[__i(_index, "numPremiums")];
    uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];
    return (numPremiumsPaid == numPremiums);
  }
}

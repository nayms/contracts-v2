pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/EntityFacetBase.sol";
import "./base/IPolicyTreasury.sol";
import "./base/IPolicyTreasuryConstants.sol";
import "./base/IEntityTreasuryFacet.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IERC20.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";

/**
 * @dev Business-logic for policy treasuries
 */
 contract EntityTreasuryFacet is EternalStorage, Controller, EntityFacetBase, IPolicyTreasury, IPolicyTreasuryConstants, IEntityTreasuryFacet, IDiamondFacet {
  using SafeMath for uint256;

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyTreasury.getEconomics.selector,
      IPolicyTreasury.getPolicyEconomics.selector,
      IPolicyTreasury.getClaims.selector,
      IPolicyTreasury.getClaim.selector,
      IPolicyTreasury.createOrder.selector,
      IPolicyTreasury.cancelOrder.selector,
      IPolicyTreasury.payClaim.selector,
      IPolicyTreasury.incPolicyBalance.selector,
      IPolicyTreasury.setMinPolicyBalance.selector,
      IPolicyTreasury.resolveClaims.selector,
      IEntityTreasuryFacet.transferFromTreasury.selector,
      IEntityTreasuryFacet.transferToTreasury.selector
    );
  }


  // IPolicyTreasury

  function getEconomics (address _unit) public view override returns (
    uint256 realBalance_,
    uint256 virtualBalance_
  ) {
    realBalance_ = dataUint256[__a(_unit, "treasuryRealBalance")];
    virtualBalance_ = dataUint256[__a(_unit, "treasuryVirtualBalance")];
  }

  function getPolicyEconomics (address _policy) public view override returns (
    address unit_,
    uint256 balance_,
    uint256 minBalance_
  ) {
    unit_ = _getPolicyUnit(_policy);
    balance_ = dataUint256[__a(_policy, "policyBalance")];
    minBalance_ = dataUint256[__a(_policy, "minPolicyBalance")];
  }

  function getClaims (address _unit) public view override returns (
    uint256 count_,
    uint256 unpaidCount_,
    uint256 unpaidTotalAmount_
  ) {
    count_ = dataUint256[__a(_unit, "claimsCount")];
    unpaidCount_ = dataUint256[__a(_unit, "claimsUnpaidCount")];
    unpaidTotalAmount_ = dataUint256[__a(_unit, "claimsUnpaidTotalAmount")];
  }

  function getClaim (address _unit, uint256 _index) public view override returns (
    address policy_,
    address recipient_,
    uint256 amount_,
    bool paid_
  ) {
    policy_ = dataAddress[__ia(_index, _unit, "claimPolicy")];
    recipient_ = dataAddress[__ia(_index, _unit, "claimRecipient")];
    amount_ = dataUint256[__ia(_index, _unit, "claimAmount")];
    paid_ = dataBool[__ia(_index, _unit, "claimPaid")];
  }

  function createOrder (bytes32 _type, address _sellUnit, uint256 _sellAmount, address _buyUnit, uint256 _buyAmount)
    public 
    override
    assertIsMyPolicy(msg.sender)
    returns (uint256)
  {
    require(_type == ORDER_TYPE_TOKEN_BUYBACK || _type == ORDER_TYPE_TOKEN_SALE, 'unknown order type');
    return _tradeOnMarket(_sellUnit, _sellAmount, _buyUnit, _buyAmount);
  }

  function cancelOrder (uint256 _orderId) 
    public 
    override 
    assertIsMyPolicy(msg.sender)
  {
    IMarket mkt = _getMarket();
    if (mkt.isActive(_orderId)) {
      mkt.cancel(_orderId);
    }
  }

  function payClaim (address _recipient, uint256 _amount)
    public
    override
    assertIsMyPolicy(msg.sender)
  {
    // check and update treasury balances
    address unit = _getPolicyUnit(msg.sender);

    string memory trbKey = __a(unit, "treasuryRealBalance");

    if (dataUint256[trbKey] < _amount) {
      string memory pcak = __a(unit, "claimsUnpaidTotalAmount");
      dataUint256[pcak] = dataUint256[pcak].add(_amount);

      dataUint256[__a(unit, "claimsCount")] += 1;
      dataUint256[__a(unit, "claimsUnpaidCount")] += 1;
      uint256 idx = dataUint256[__a(unit, "claimsCount")];

      dataAddress[__ia(idx, unit, "claimPolicy")] = msg.sender;
      dataAddress[__ia(idx, unit, "claimRecipient")] = _recipient;
      dataUint256[__ia(idx, unit, "claimAmount")] = _amount;
    } else {
      _decPolicyBalance(msg.sender, _amount);

      // payout!
      IERC20(unit).transfer(_recipient, _amount);
    }
  }

  function incPolicyBalance (uint256 _amount) 
    public 
    override
    assertIsMyPolicy(msg.sender)
  {
    _incPolicyBalance(msg.sender, _amount);
  }

  function setMinPolicyBalance (uint256 _bal) 
    public 
    override
    assertIsMyPolicy(msg.sender)
  {
    string memory key = __a(msg.sender, "minPolicyBalance");

    require(dataUint256[key] == 0, 'already set');

    dataUint256[key] = _bal;

    emit SetMinPolicyBalance(msg.sender, _bal);
  }

  // IEntityTreasuryFacet

  function transferToTreasury(address _unit, uint256 _amount) public override {
    _assertHasEnoughBalance(_unit, _amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].sub(_amount);
    string memory trbKey = __a(_unit, "treasuryRealBalance");
    dataUint256[trbKey] = dataUint256[trbKey].add(_amount);
    resolveClaims(_unit);
    emit TransferToTreasury(msg.sender, _unit, _amount);
  }

  function transferFromTreasury(address _unit, uint256 _amount) public override {
    string memory trbKey = __a(_unit, "treasuryRealBalance");
    require(dataUint256[trbKey] >= _amount, "exceeds treasury balance");
    dataUint256[trbKey] = dataUint256[trbKey].sub(_amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].add(_amount);
    emit TransferFromTreasury(msg.sender, _unit, _amount);
  }

  function resolveClaims (address _unit) public override {
    uint256 cnt = dataUint256[__a(_unit, "claimsCount")];

    uint256 startIndex = cnt - dataUint256[__a(_unit, "claimsUnpaidCount")] + 1;
    uint256 endIndex = cnt;

    for (uint256 i = startIndex; i <= endIndex; i += 1) {
      if (!dataBool[__ia(i, _unit, "claimPaid")]) {
        // get amt
        uint256 amt = dataUint256[__ia(i, _unit, "claimAmount")];

        // if we have enough funds
        if (amt <= dataUint256[__a(_unit, "treasuryRealBalance")]) {
          // update internals
          _decPolicyBalance(
            dataAddress[__ia(i, _unit, "claimPolicy")], 
            amt
          );
          // payout
          IERC20(_unit).transfer(dataAddress[__ia(i, _unit, "claimRecipient")], amt);
          // mark as paid
          dataBool[__ia(i, _unit, "claimPaid")] = true;
        }
      }
    }
  }

  // Internal

  function _getPolicyUnit (address _policy) internal view returns (address) {
    address policyUnitAddress;
    {
      uint256 i1;
      uint256 i2;
      uint256 i3;
      address a1;
      (a1, i1, i2, i3, policyUnitAddress, , , , , ,) = IPolicyCoreFacet(_policy).getInfo();
    }

    return policyUnitAddress;
  }

  function _incPolicyBalance (address _policy, uint256 _amount) internal {
    address unit = _getPolicyUnit(_policy);

    string memory pbKey = __a(msg.sender, "policyBalance");
    string memory trbKey = __a(unit, "treasuryRealBalance");
    string memory tvbKey = __a(unit, "treasuryVirtualBalance");

    dataUint256[trbKey] = dataUint256[trbKey].add(_amount);
    dataUint256[tvbKey] = dataUint256[tvbKey].add(_amount);
    dataUint256[pbKey] = dataUint256[pbKey].add(_amount);

    emit UpdatePolicyBalance(msg.sender, dataUint256[pbKey]);
  }

  function _decPolicyBalance (address _policy, uint256 _amount) internal {
    address unit = _getPolicyUnit(_policy);

    string memory pbKey = __a(msg.sender, "policyBalance");
    string memory trbKey = __a(unit, "treasuryRealBalance");
    string memory tvbKey = __a(unit, "treasuryVirtualBalance");

    if (dataUint256[pbKey] < _amount) {
      dataUint256[tvbKey] = dataUint256[tvbKey].sub(dataUint256[pbKey]);
      dataUint256[pbKey] = 0;
    } else {
      dataUint256[pbKey] = dataUint256[pbKey].sub(_amount);
      dataUint256[tvbKey] = dataUint256[tvbKey].sub(_amount);
    }

    dataUint256[trbKey] = dataUint256[trbKey].sub(_amount);

    emit UpdatePolicyBalance(msg.sender, dataUint256[pbKey]);
  }
}

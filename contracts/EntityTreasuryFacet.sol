pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/EntityFacetBase.sol";
import "./base/IPolicyTreasury.sol";
import "./base/IPolicyTreasuryConstants.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IERC20.sol";
import "./base/IDiamondFacet.sol";
import "./base/SafeMath.sol";

/**
 * @dev Business-logic for policy treasuries
 */
 contract EntityTreasuryFacet is EternalStorage, Controller, EntityFacetBase, IPolicyTreasury, IPolicyTreasuryConstants, IDiamondFacet {
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
      IPolicyTreasury.getPendingClaims.selector,
      IPolicyTreasury.getPendingClaim.selector,
      IPolicyTreasury.createOrder.selector,
      IPolicyTreasury.cancelOrder.selector,
      IPolicyTreasury.payClaim.selector,
      IPolicyTreasury.incPolicyBalance.selector,
      IPolicyTreasury.setMinPolicyBalance.selector
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

  function getPendingClaims (address _unit) public view override returns (
    uint256 count_,
    uint256 totalAmount_
  ) {
    count_ = dataUint256[__a(_unit, "pendingClaimsCount")];
    totalAmount_ = dataUint256[__a(_unit, "pendingClaimsTotal")];
  }

  function getPendingClaim (address _unit, uint256 _index) public view override returns (
    address policy_,
    address recipient_,
    uint256 amount_
  ) {
    policy_ = dataAddress[__ia(_index, _unit, "pendingClaimPolicy")];
    recipient_ = dataAddress[__ia(_index, _unit, "pendingClaimRecipient")];
    amount_ = dataUint256[__ia(_index, _unit, "pendingClaimAmount")];
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
      string memory pcak = __a(unit, "pendingClaimsTotal");
      dataUint256[pcak] = dataUint256[pcak].add(_amount);

      dataUint256[__a(unit, "pendingClaimsCount")] += 1;
      uint256 idx = dataUint256[__a(unit, "pendingClaimsCount")];

      dataAddress[__ia(idx, unit, "pendingClaimPolicy")] = msg.sender;
      dataAddress[__ia(idx, unit, "pendingClaimRecipient")] = _recipient;
      dataUint256[__ia(idx, unit, "pendingClaimAmount")] = _amount;
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

    dataUint256[trbKey] = dataUint256[trbKey].add(uint256(_amount));
    dataUint256[tvbKey] = dataUint256[tvbKey].add(uint256(_amount));
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
      dataUint256[pbKey] = dataUint256[pbKey].sub(uint256(_amount));
      dataUint256[tvbKey] = dataUint256[tvbKey].sub(uint256(_amount));
    }

    dataUint256[trbKey] = dataUint256[trbKey].sub(uint256(_amount));

    emit UpdatePolicyBalance(msg.sender, dataUint256[pbKey]);
  }
}

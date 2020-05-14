pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityImpl.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/IPolicyImpl.sol";
import "./Policy.sol";

/**
 * @dev Business-logic for Entity
 */
 contract EntityImpl is EternalStorage, Controller, IEntityImpl, IDiamondFacet {
  modifier assertCanWithdraw () {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_ADMINS), 'must be entity admin');
    _;
  }

  modifier assertCanCreatePolicy () {
    require(inRoleGroup(msg.sender, ROLEGROUP_POLICY_CREATORS), 'must be policy creator');
    _;
  }

  modifier assertCanTradeTranchTokens () {
    require(inRoleGroup(msg.sender, ROLEGROUP_TRADERS), 'must be trader');
    _;
  }

  modifier assertCanPayTranchPremiums (address _policyAddress) {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_REPS), 'must be entity rep');
    AccessControl a = AccessControl(_policyAddress);
    bytes32 ctx = a.aclContext();
    require(inRoleGroupWithContext(ctx, msg.sender, ROLEGROUP_CLIENT_MANAGERS), 'must be client manager');
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
      IEntityImpl.createPolicy.selector,
      IEntityImpl.getNumPolicies.selector,
      IEntityImpl.getPolicy.selector,
      IEntityImpl.deposit.selector,
      IEntityImpl.withdraw.selector,
      IEntityImpl.payTranchPremium.selector,
      IEntityImpl.trade.selector,
      IEntityImpl.sellAtBestPrice.selector
    );
  }


  // IEntityImpl

  function createPolicy(
    uint256 _initiationDate,
    uint256 _startDate,
    uint256 _maturationDate,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256 _brokerCommissionBP,
    uint256 _assetManagerCommissionBP,
    uint256 _naymsCommissionBP
  )
    public
    override
    assertCanCreatePolicy
  {
    Policy f = new Policy(
      address(acl()),
      address(settings()),
      address(this),
      settings().getRootAddress(SETTING_POLICY_IMPL),
      msg.sender,
      _initiationDate,
      _startDate,
      _maturationDate,
      _unit,
      _premiumIntervalSeconds,
      _brokerCommissionBP,
      _assetManagerCommissionBP,
      _naymsCommissionBP
    );

    uint256 numPolicies = dataUint256["numPolicies"];
    dataAddress[__i(numPolicies, "policy")] = address(f);
    dataUint256["numPolicies"] = numPolicies + 1;

    emit NewPolicy(address(f), address(this), msg.sender);
  }


  function getNumPolicies() public view override returns (uint256) {
    return dataUint256["numPolicies"];
  }

  function getPolicy(uint256 _index) public view override returns (address) {
    return dataAddress[__i(_index, "policy")];
  }

  function deposit(address _unit, uint256 _amount) public override {
    IERC20 tok = IERC20(_unit);
    tok.transferFrom(msg.sender, address(this), _amount);
  }

  function withdraw(address _unit, uint256 _amount) public override assertCanWithdraw {
    IERC20 tok = IERC20(_unit);
    tok.transfer(msg.sender, _amount);
  }

  function payTranchPremium(address _policyAddress, uint256 _tranchIndex)
    public
    override
    assertCanPayTranchPremiums(_policyAddress)
  {
    address policyUnitAddress;
    uint256 nextPremiumAmount;
    uint256 i1;
    uint256 i2;
    uint256 i3;
    uint256 i4;
    address a1;

    IPolicyImpl p = IPolicyImpl(_policyAddress);
    // policy's unit
    (a1, i1, i2, i3, policyUnitAddress, , , , , ,) = p.getInfo();
    // next premium amount
    (a1, i1, i2, i3, i4, nextPremiumAmount, , , , ,) = p.getTranchInfo(_tranchIndex);
    // approve transfer
    IERC20 tok = IERC20(policyUnitAddress);
    tok.approve(_policyAddress, nextPremiumAmount);
    // do it
    p.payTranchPremium(_tranchIndex);
  }

  function trade(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount)
    public
    override
    assertCanTradeTranchTokens
  {
    // get mkt
    address mktAddress = settings().getRootAddress(SETTING_MARKET);
    IMarket mkt = IMarket(mktAddress);
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_payUnit);
    tok.approve(mktAddress, _payAmount);
    // make the offer
    mkt.offer(_payAmount, _payUnit, _buyAmount, _buyUnit, 0, false);
  }

  function sellAtBestPrice(address _sellUnit, uint256 _sellAmount, address _buyUnit)
    public
    override
    assertCanTradeTranchTokens
  {
    // get mkt
    address mktAddress = settings().getRootAddress(SETTING_MARKET);
    IMarket mkt = IMarket(mktAddress);
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_sellUnit);
    tok.approve(mktAddress, _sellAmount);
    // make the offer
    mkt.sellAllAmount(_sellUnit, _sellAmount, _buyUnit, _sellAmount);
  }
}

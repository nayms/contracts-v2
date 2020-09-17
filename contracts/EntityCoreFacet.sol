pragma solidity >=0.6.7;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/IPolicy.sol";
import "./TranchToken.sol";
import "./Policy.sol";
import "./EntityToken.sol";

/**
 * @dev Business-logic for Entity
 */
 contract EntityCoreFacet is EternalStorage, Controller, IEntityCoreFacet, IDiamondFacet {
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
      IEntityCoreFacet.getToken.selector,
      IEntityCoreFacet.createPolicy.selector,
      IEntityCoreFacet.getNumPolicies.selector,
      IEntityCoreFacet.getPolicy.selector,
      IEntityCoreFacet.deposit.selector,
      IEntityCoreFacet.withdraw.selector,
      IEntityCoreFacet.payTranchPremium.selector,
      IEntityCoreFacet.trade.selector,
      IEntityCoreFacet.sellAtBestPrice.selector
    );
  }

  // IEntityCoreFacet

  function getToken() public view override returns (address) {
    return dataAddress["token"];
  }

  function createPolicy(
    uint256[] memory _dates,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256[] memory _commmissionsBP
  )
    public
    override
    assertCanCreatePolicy
  {
    Policy f = new Policy(
      address(acl()),
      address(settings()),
      address(this),
      msg.sender,
      _dates,
      _unit,
      _premiumIntervalSeconds,
      _commmissionsBP
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

  function payTranchPremium(address _policy, uint256 _tranchIndex)
    public
    override
    assertCanPayTranchPremiums(_policy)
  {
    address policyUnitAddress;
    uint256 nextPremiumAmount;
    uint256 i1;
    uint256 i2;
    uint256 i3;
    address a1;

    IPolicy p = IPolicy(_policy);
    // policy's unit
    (a1, i1, i2, i3, policyUnitAddress, , , , , ,) = p.getInfo();
    // next premium amount
    (a1, i1, i2, i3, nextPremiumAmount, , , , , ,) = p.getTranchInfo(_tranchIndex);
    // approve transfer
    IERC20 tok = IERC20(policyUnitAddress);
    tok.approve(_policy, nextPremiumAmount);
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

pragma solidity 0.6.12;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./EntityFacetBase.sol";
import "./base/IEntityCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/IPolicy.sol";
import "./base/SafeMath.sol";
import "./Policy.sol";

/**
 * @dev Business-logic for Entity
 */
 contract EntityCoreFacet is EternalStorage, Controller, EntityFacetBase, IEntityCoreFacet, IDiamondFacet {
  using SafeMath for uint256;

  modifier assertCanTradeTranchTokens () {
    require(inRoleGroup(msg.sender, ROLEGROUP_TRADERS), 'must be trader');
    _;
  }

  modifier assertCanPayTranchPremiums (address _policyAddress) {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_REPS), 'must be entity rep');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityCoreFacet.createPolicy.selector,
      IEntityCoreFacet.getBalance.selector,
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

  function createPolicy(
    uint256[] calldata _dates,
    address _unit,
    uint256 _premiumIntervalSeconds,
    uint256[] calldata _commmissionsBP,
    address[] calldata _stakeholders 
  )
    external
    override
  {
    address[] memory stakeholders = new address[](6);
    stakeholders[0] = address(this);
    stakeholders[1] = msg.sender;
    stakeholders[2] = _stakeholders[0];
    stakeholders[3] = _stakeholders[1];
    stakeholders[4] = _stakeholders[2];
    stakeholders[5] = _stakeholders[3];

    require(
      IAccessControl(stakeholders[2]).aclContext() == aclContext(), 
      'underwriter ACL context must match'
    );

    Policy f = new Policy(
      address(settings()),
      stakeholders,
      _dates,
      _unit,
      _premiumIntervalSeconds,
      _commmissionsBP
    );

    uint256 numPolicies = dataUint256["numPolicies"];
    address pAddr = address(f);
    dataAddress[__i(numPolicies, "policy")] = pAddr;
    dataUint256["numPolicies"] = numPolicies + 1;
    dataBool[__a(pAddr, "isPolicy")] = true; // for _isPolicyCreatedByMe() to work

    emit NewPolicy(pAddr, address(this), msg.sender);
  }

  function getBalance(address _unit) public view override returns (uint256) {
    return dataUint256[__a(_unit, "balance")];
  }

  function getNumPolicies() public view override returns (uint256) {
    return dataUint256["numPolicies"];
  }

  function getPolicy(uint256 _index) public view override returns (address) {
    return dataAddress[__i(_index, "policy")];
  }

  function deposit(address _unit, uint256 _amount) 
    external 
    override 
  {
    IERC20 tok = IERC20(_unit);
    tok.transferFrom(msg.sender, address(this), _amount);
    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].add(_amount);
    
    emit EntityDeposit(msg.sender, _unit, _amount);
  }

  function withdraw(address _unit, uint256 _amount) 
    external 
    override 
    assertIsEntityAdmin(msg.sender)
  {
    _assertHasEnoughBalance(_unit, _amount);

    dataUint256[__a(_unit, "balance")] = dataUint256[__a(_unit, "balance")].sub(_amount);

    IERC20 tok = IERC20(_unit);
    tok.transfer(msg.sender, _amount);

    emit EntityWithdraw(msg.sender, _unit, _amount);
  }

  function payTranchPremium(address _policy, uint256 _tranchIndex, uint256 _amount)
    external
    override
    assertCanPayTranchPremiums(_policy)
  {
    address policyUnitAddress;

    IPolicy p = IPolicy(_policy);

    // avoid stack too deep errors
    {
      uint256 i1;
      uint256 i2;
      uint256 i3;
      address a1;

      // policy's unit
      (a1, i1, i2, i3, policyUnitAddress, , , , , ,) = p.getInfo();
    }
    
    // check balance
    _assertHasEnoughBalance(policyUnitAddress, _amount);

    // approve transfer
    IERC20 tok = IERC20(policyUnitAddress);
    tok.approve(_policy, _amount);

    // do it
    p.payTranchPremium(_tranchIndex, _amount);
  }

  function trade(address _payUnit, uint256 _payAmount, address _buyUnit, uint256 _buyAmount)
    external
    override
    assertCanTradeTranchTokens
    returns (uint256)
  {
    // check balance
    _assertHasEnoughBalance(_payUnit, _payAmount);
    // do it
    return _tradeOnMarket(_payUnit, _payAmount, _buyUnit, _buyAmount);
  }

  function sellAtBestPrice(address _sellUnit, uint256 _sellAmount, address _buyUnit)
    external
    override
    assertCanTradeTranchTokens
    returns (uint256)
  {
    // check balance
    _assertHasEnoughBalance(_sellUnit, _sellAmount);
    // do it!
    return _sellAtBestPriceOnMarket(_sellUnit, _sellAmount, _buyUnit);
  }
}

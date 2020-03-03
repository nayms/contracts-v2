pragma solidity >=0.5.8;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityImpl.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./Policy.sol";

/**
 * @dev Business-logic for Entity
 */
 contract EntityImpl is EternalStorage, Controller, IEntityImpl, IProxyImpl {
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

  /**
   * Constructor
   */
  constructor (address _acl, address _settings)
    Controller(_acl, _settings)
    public
  {
    // empty
  }

  // IProxyImpl

  function getImplementationVersion () public pure returns (string memory) {
    return "v1";
  }


  // IEntityImpl

  function createPolicy(
    address _impl,
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
    assertCanCreatePolicy
  {
    Policy f = new Policy(
      address(acl()),
      address(settings()),
      aclContext(),
      _impl,
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
    dataAddress[string(abi.encodePacked("policy", numPolicies))] = address(f);
    dataUint256["numPolicies"] = numPolicies + 1;

    emit NewPolicy(address(f), address(this), msg.sender);
  }


  function getNumPolicies() public view returns (uint256) {
    return dataUint256["numPolicies"];
  }

  function getPolicy(uint256 _index) public view returns (address) {
    return dataAddress[string(abi.encodePacked("policy", _index))];
  }

  function deposit(address _unit, uint256 _amount) public {
    IERC20 tok = IERC20(_unit);
    tok.transferFrom(msg.sender, address(this), _amount);
  }

  function withdraw(address _unit, uint256 _amount) public assertCanWithdraw {
    IERC20 tok = IERC20(_unit);
    tok.transfer(msg.sender, _amount);
  }

  function buyTokens(address _buyUnit, uint256 _buyAmount, address _payUnit, uint256 _payAmount)
    public
    assertCanTradeTranchTokens
  {
    // get mkt
    address mktAddress = settings().getMatchingMarket();
    IMarket mkt = IMarket(mktAddress);
    // approve mkt to use my tokens
    IERC20 tok = IERC20(_payUnit);
    tok.approve(mktAddress, _payAmount);
    // make the offer
    mkt.offer(_payAmount, _payUnit, _buyAmount, _buyUnit, 0, false);
  }
}

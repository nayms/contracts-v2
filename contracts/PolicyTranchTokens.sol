pragma solidity >=0.6.7;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyTranchTokens.sol";
import "./base/PolicyFacetBase.sol";
import "./base/AccessControl.sol";
import "./base/SafeMath.sol";
import "./base/IERC20.sol";

/**
 * @dev Business-logic for Policy commissions
 */
contract PolicyTranchTokens is EternalStorage, Controller, IDiamondFacet, IPolicyTranchTokens, PolicyFacetBase {
  using SafeMath for uint;

  modifier assertIsAssetManager (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_ASSET_MANAGERS), 'must be asset manager');
    _;
  }

  modifier assertIsBroker (address _addr) {
    require(inRoleGroup(_addr, ROLEGROUP_BROKERS), 'must be broker');
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
      IPolicyTranchTokens.tknName.selector,
      IPolicyTranchTokens.tknSymbol.selector,
      IPolicyTranchTokens.tknTotalSupply.selector,
      IPolicyTranchTokens.tknBalanceOf.selector,
      IPolicyTranchTokens.tknAllowance.selector,
      IPolicyTranchTokens.tknApprove.selector,
      IPolicyTranchTokens.tknTransfer.selector
    );
  }

  // IPolicyTranchTokens

  function tknName(uint256 _index) public view override returns (string memory) {
    return string(abi.encodePacked(address(this).toString(), "_tranch_", _index));
  }

  function tknSymbol(uint256 _index) public view override returns (string memory) {
    return tknName(_index);
  }

  function tknTotalSupply(uint256 _index) public view override returns (uint256) {
    return dataUint256[__i(_index, "numShares")];
  }

  function tknBalanceOf(uint256 _index, address _owner) public view override returns (uint256) {
    string memory k = __ia(_index, _owner, "balance");
    return dataUint256[k];
  }

  function tknAllowance(uint256 _index, address _spender, address _owner) public view override returns (uint256) {
    string memory k = __iaa(_index, _owner, _spender, "allowance");
    return dataUint256[k];
  }

  function tknApprove(uint256 /*_index*/, address _spender, address /*_from*/, uint256 /*_value*/) public override {
    require(_spender == settings().getRootAddress(SETTING_MARKET), 'only nayms market is allowed to transfer');
  }

  function tknTransfer(uint256 _index, address _spender, address _from, address _to, uint256 _value) public override {
    require(_spender == settings().getRootAddress(SETTING_MARKET), 'only nayms market is allowed to transfer');
    _transfer(_index, _from, _to, _value);
  }

  // Internal functions

  function _transfer(uint _index, address _from, address _to, uint256 _value) private {
    // when token holder is sending to the market
    address market = settings().getRootAddress(SETTING_MARKET);
    if (market == _to) {
      // and they're not the initial balance holder of the token (i.e. the policy/tranch)
      address initialHolder = dataAddress[__i(_index, "initialHolder")];
      if (initialHolder != _from) {
        // then they must be a trader, in which case ony allow this if the policy is active
        require(dataUint256["state"] == POLICY_STATE_ACTIVE, 'can only trade when policy is active');
      }
    }

    string memory fromKey = __ia(_index, _from, "balance");
    string memory toKey = __ia(_index, _to, "balance");

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);

    // if we are in the initial sale period and this is a transfer from the market to a buyer
    if (dataUint256[__i(_index, "state")] == TRANCH_STATE_SELLING && market == _from) {
      // record how many "shares" were sold
      dataUint256[__i(_index, "sharesSold")] = dataUint256[__i(_index, "sharesSold")].add(_value);
      // update tranch balance
      dataUint256[__i(_index, "balance")] = dataUint256[__i(_index, "balance")].add(_value * dataUint256[__i(_index, "pricePerShareAmount")]);

      // if the tranch has fully sold out
      if (dataUint256[__i(_index, "sharesSold")] == dataUint256[__i(_index, "numShares")]) {
        // flip tranch state to ACTIVE
        _setTranchState(_index, TRANCH_STATE_ACTIVE);
      }
    }
  }
}

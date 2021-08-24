pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/Controller.sol";
import "./base/IDiamondFacet.sol";
import "./base/IPolicyTranchTokensFacet.sol";
import "./base/IMarketObserver.sol";
import "./base/IMarketObserverDataTypes.sol";
import "./base/AccessControl.sol";
import "./base/SafeMath.sol";
import "./base/Address.sol";
import "./base/Strings.sol";
import "./base/Uint.sol";
import "./base/IERC20.sol";
import "./PolicyFacetBase.sol";

/**
 * @dev Business-logic for Policy commissions
 */
contract PolicyTranchTokensFacet is EternalStorage, Controller, IDiamondFacet, IPolicyTranchTokensFacet, PolicyFacetBase, IMarketObserver, IMarketObserverDataTypes {
  using SafeMath for uint;
  using Uint for uint;
  using Address for address;
  using Strings for string;

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
    // empty
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IPolicyTranchTokensFacet.tknName.selector,
      IPolicyTranchTokensFacet.tknSymbol.selector,
      IPolicyTranchTokensFacet.tknTotalSupply.selector,
      IPolicyTranchTokensFacet.tknBalanceOf.selector,
      IPolicyTranchTokensFacet.tknAllowance.selector,
      IPolicyTranchTokensFacet.tknApprove.selector,
      IPolicyTranchTokensFacet.tknTransfer.selector,
      IMarketObserver.handleTrade.selector,
      IMarketObserver.handleClosure.selector
    );
  }

  // IPolicyTranchTokensFacet

  function tknName(uint256 _index) public view override returns (string memory) {
    return string(abi.encodePacked("NAYMS-", address(this).toString(), "-TRANCH-", uint256(_index + 1).toString()));
  }

  function tknSymbol(uint256 _index) public view override returns (string memory) {
    // max len = 11 chars
    return string(abi.encodePacked("N-", address(this).toString().substring(6), "-", uint256(_index + 1).toString()));
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
    address treasury = address(_getTreasury());

    // if this is a transfer to the market
    if (market == _to) {
      // and the sender is not the initial holder of the token
      address initialHolder = dataAddress[__i(_index, "initialHolder")];
      if (initialHolder != _from) {
        // then the sender must be a trader, in which case ony allow this if the policy is active
        require(dataUint256["state"] == POLICY_STATE_ACTIVE, 'can only trade when policy is active');
      }
    }

    string memory fromKey = __ia(_index, _from, "balance");
    string memory toKey = __ia(_index, _to, "balance");

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);
  }

  function handleTrade(
    uint256 _offerId,
    address _sellToken, 
    uint256 _soldAmount, 
    address _buyToken, 
    uint256 _boughtAmount,
    address _feeToken, 
    uint256 _feeAmount,
    address _seller,
    address _buyer,
    bytes memory _data
  ) external override {
    if (_data.length == 0) {
      return;
    }

    // get data type
    (uint256 t) = abi.decode(_data, (uint256));

    if (t == MODT_TRANCH_SALE) {
      // get policy address and tranch id
      (, address policy, uint256 tranchId) = abi.decode(_data, (uint256, address, uint256));

      // if we created this offer
      if (policy == address(this)) {
        // if we are in the initial sale period      
        if (dataUint256[__i(tranchId, "state")] == TRANCH_STATE_SELLING) {
          // check tranch token matches sell token
          address tranchAddress = dataAddress[__i(tranchId, "address")];
          require(tranchAddress == _sellToken, "sell token must be tranch token");
          // record how many "shares" were sold
          dataUint256[__i(tranchId, "sharesSold")] = dataUint256[__i(tranchId, "sharesSold")].add(_soldAmount);
          // update tranch balance
          dataUint256[__i(tranchId, "balance")] = dataUint256[__i(tranchId, "balance")].add(_boughtAmount);
          // tell treasury to add tranch balance value to overall policy balance
          _getTreasury().incPolicyBalance(_boughtAmount);
          // if the tranch has fully sold out
          if (dataUint256[__i(tranchId, "sharesSold")] == dataUint256[__i(tranchId, "numShares")]) {
            // flip tranch state to ACTIVE
            _setTranchState(tranchId, TRANCH_STATE_ACTIVE);
          }
        }
      }
    }
  }

  function handleClosure(
    uint256 _offerId,
    address _sellToken, 
    uint256 _unsoldAmount, 
    address _buyToken, 
    uint256 _unboughtAmount,
    address _seller,
    bytes memory _data
  ) external override {
    if (_data.length == 0) {
      return;
    }

    // get data type
    (uint256 t) = abi.decode(_data, (uint256));

    // if it's a tranch token buyback trade
    if (t == MODT_TRANCH_BUYBACK) {
      // get policy address and tranch id
      (, address policy, uint256 tranchId) = abi.decode(_data, (uint256, address, uint256));

      // if we created this offer
      if (policy == address(this)) {
        // if we are in the policy buyback state
        if (dataUint256["state"] == POLICY_STATE_BUYBACK) {
          // check tranch token matches buy token
          address tranchAddress = dataAddress[__i(tranchId, "address")];
          require(tranchAddress == _buyToken, "buy token must be tranch token");

          // NOTE: we're assuming that an order never gets closed until it is sold out
          // Sold out = only <=dusk amount remaining (see market for dusk level)

          // mark buyback as complete
          dataBool[__i(tranchId, "buybackCompleted")] = true;
          dataUint256["numTranchesBoughtBack"] += 1;

          // if all tranches have been bought back
          if (dataUint256["numTranchesBoughtBack"] == dataUint256["numTranches"]) {
            // policy is now "closed"
            _setPolicyState(POLICY_STATE_CLOSED);
          }
        }
      }
    }    
  }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./base/IEntityTokensFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/IMarketObserver.sol";
import "./base/IMarketObserverDataTypes.sol";
import "./base/SafeMath.sol";
import "./base/Strings.sol";
import "./EntityFacetBase.sol";
import "./EntityToken.sol";

contract EntityTokensFacet is EternalStorage, Controller, EntityFacetBase, IEntityTokensFacet, IMarketObserver, IMarketObserverDataTypes, IDiamondFacet {
  using SafeMath for uint256;
  using Strings for string;

  modifier assertCanStartTokenSale () {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_MANAGERS), 'must be entity mgr');
    _;
  }

  modifier assertCanCancelTokenSale () {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_MANAGERS), 'must be entity mgr');
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
      IEntityTokensFacet.getTokenInfo.selector,
      IEntityTokensFacet.burnTokens.selector,
      IEntityTokensFacet.startTokenSale.selector,
      IEntityTokensFacet.cancelTokenSale.selector,
      IEntityTokensFacet.tknName.selector,
      IEntityTokensFacet.tknSymbol.selector,
      IEntityTokensFacet.tknTotalSupply.selector,
      IEntityTokensFacet.tknBalanceOf.selector,
      IEntityTokensFacet.tknAllowance.selector,
      IEntityTokensFacet.tknApprove.selector,
      IEntityTokensFacet.tknTransfer.selector,
      IMarketObserver.handleTrade.selector,
      IMarketObserver.handleClosure.selector
    );
  }


  // IEntityTokensFacet

  function getTokenInfo() external view override returns (
    address tokenContract_,
    uint256 currentTokenSaleOfferId_
  ) {
    tokenContract_ = dataAddress["token"];
    currentTokenSaleOfferId_ = dataUint256["tokenSaleOfferId"];
  }

  function burnTokens(uint256 _amount) external override {
    _burn(msg.sender, _amount);
  }

  function startTokenSale(uint256 _amount, address _priceUnit, uint256 _totalPrice) 
    external
    override
    assertCanStartTokenSale
  {
    _assertNoTokenSaleInProgress();

    // mint token if it doesn't exist
    if (dataAddress["token"] == address(0)) {
      dataAddress["token"] = address(new EntityToken(address(this)));
    }

    string memory k = __a(address(this), "tokenBalance");

    dataUint256[k] = dataUint256[k].add(_amount);
    dataUint256["tokenSupply"] = dataUint256["tokenSupply"].add(_amount);

    dataUint256["tokenSaleOfferId"] = _getMarket().executeLimitOfferWithObserver(
      dataAddress["token"], 
      _amount, 
      _priceUnit, 
      _totalPrice, 
      FEE_SCHEDULE_PLATFORM_ACTION,
      address(this), 
      abi.encode(MODT_ENTITY_SALE, address(this))
    );
  }

  function cancelTokenSale() 
    external
    override
    assertCanCancelTokenSale
  {
    uint256 offerId = dataUint256["tokenSaleOfferId"];
    require(offerId > 0, "no active token sale");
    _getMarket().cancel(offerId);
  }


  function tknName() public view override returns (string memory) {
    return string(abi.encodePacked("NAYMS-", address(this).toString(), "-ENTITY"));
  }

  function tknSymbol() public view override returns (string memory) {
    // max len = 11 chars
    return string(abi.encodePacked("N-", address(this).toString().substring(6), "-E"));
  }

  function tknTotalSupply() public view override returns (uint256) {
    return dataUint256["tokenSupply"];
  }

  function tknBalanceOf(address _owner) public view override returns (uint256) {
    string memory k = __a(_owner, "tokenBalance");
    return dataUint256[k];
  }

  function tknAllowance(address _spender, address _owner) public view override returns (uint256) {
    string memory k = __iaa(0, _owner, _spender, "tokenAllowance");
    return dataUint256[k];
  }

  function tknApprove(address _spender, address /*_from*/, uint256 /*_value*/) public override {
    require(_spender == settings().getRootAddress(SETTING_MARKET), 'only nayms market is allowed to transfer');
  }

  function tknTransfer(address _spender, address _from, address _to, uint256 _value) public override {
    require(_spender == settings().getRootAddress(SETTING_MARKET), 'only nayms market is allowed to transfer');
    _transfer(_from, _to, _value);
  }

  // IMarketObserver

  function handleTrade(
    uint256 _offerId,
    uint256 /*_soldAmount*/, 
    uint256 _boughtAmount,
    address /*_feeToken*/, 
    uint256 /*_feeAmount*/,
    address /*_buyer*/,
    bytes memory _data
  ) external override {
    if (_data.length == 0) {
      return;
    }

    // get data type
    (uint256 t) = abi.decode(_data, (uint256));

    // if it's an entity token sale
    if (t == MODT_ENTITY_SALE) {
      // get entity address
      (, address entity) = abi.decode(_data, (uint256, address));

      // if we created this offer
      if (entity == address(this)) {
        // check entity token matches sell token
        (, address sellToken, , , address buyToken, , , , , ,) = _getMarket().getOffer(_offerId);
        address tokenAddress = dataAddress["token"];
        require(tokenAddress == sellToken, "sell token must be entity token");

        // add bought amount to balance
        string memory balKey = __a(buyToken, "balance");
        dataUint256[balKey] = dataUint256[balKey].add(_boughtAmount);
      }
    }    
  }

  function handleClosure(
    uint256 _offerId,
    uint256 _unsoldAmount, 
    uint256 /*_unboughtAmount*/,
    bytes memory _data
  ) external override {
    if (_data.length == 0) {
      return;
    }

    // get data type
    (uint256 t) = abi.decode(_data, (uint256));

    // if it's an entity token sale
    if (t == MODT_ENTITY_SALE) {
      // get entity address
      (, address entity) = abi.decode(_data, (uint256, address));

      // if we created this offer
      if (entity == address(this)) {
        // check entity token matches sell token
        (, address sellToken, , , , , , , , ,) = _getMarket().getOffer(_offerId);
        address tokenAddress = dataAddress["token"];
        require(tokenAddress == sellToken, "sell token must be entity token");

        // burn the unsold amount (currently owned by the entity since the market has already sent it back)
        if (_unsoldAmount > 0) {
          _burn(address(this), _unsoldAmount);
        }

        // reset sale id
        dataUint256["tokenSaleOfferId"] = 0;
      }
    }    
  }

  // Internal functions

  function _transfer(address _from, address _to, uint256 _value) private {
    require(_value > 0, "cannot transfer zero");

    string memory fromKey = __a(_from, "tokenBalance");
    string memory toKey = __a(_to, "tokenBalance");

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);

    // add recipient to the token holder list
    if (dataUint256[__a(_to, "tokenHolderIndex")] == 0) {
      dataUint256["numTokenHolders"] += 1;
      dataAddress[__i(dataUint256["numTokenHolders"], "tokenHolder")] = _to;
      dataUint256[__a(_to, "tokenHolderIndex")] = dataUint256["numTokenHolders"];
    }

    // if sender now has 0 balance then remove them from the token holder list
    if (dataUint256[fromKey] == 0 && dataUint256[__a(_from, "tokenHolderIndex")] > 0) {
      _removeTokenHolder(_from);
    }
  }

  function _removeTokenHolder(address _holder) private {
    uint256 idx = dataUint256[__a(_holder, "tokenHolderIndex")];
    dataUint256[__a(_holder, "tokenHolderIndex")] = 0;

    // fast delete: replace with item currently at end of list
    if (dataUint256["numTokenHolders"] > 1) {
      address lastHolder = dataAddress[__i(dataUint256["numTokenHolders"], "tokenHolder")];
      dataAddress[__i(idx, "tokenHolder")] = lastHolder;
      dataUint256[__a(lastHolder, "tokenHolderIndex")] = idx;
    } else {
      dataAddress[__i(idx, "tokenHolder")] = address(0);          
    }

    dataUint256["numTokenHolders"] -= 1;
  }

  function _burn(address _holder, uint256 _amount) private {
    require(_amount > 0, "cannot burn zero");    
    
    string memory k = __a(_holder, "tokenBalance");
    require(dataUint256[k] >= _amount, "not enough balance to burn");    
    dataUint256[k] = dataUint256[k].sub(_amount);

    if (dataUint256[k] == 0) {
      _removeTokenHolder(_holder);
    }

    dataUint256["tokenSupply"] = dataUint256["tokenSupply"].sub(_amount);
  }
}

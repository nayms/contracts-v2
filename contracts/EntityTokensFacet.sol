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
    string memory k = __a(msg.sender, "tokenBalance");
    require(dataUint256[k] >= _amount, "not enough balance to burn");
    dataUint256[k] = dataUint256[k].sub(_amount);
    dataUint256["tokenSupply"] = dataUint256["tokenSupply"].sub(_amount);
  }

  function startTokenSale(uint256 _amount, address _priceUnit, uint256 _totalPrice) 
    external
    override
    assertCanStartTokenSale
  {
    require(dataUint256["tokenSaleOfferId"] == 0, "token sale already in progress");

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
    if (t == MODT_ENTITY_SALE) {
      // get entity address
      (, address entity) = abi.decode(_data, (uint256, address));

      // if we created this offer
      if (entity == address(this)) {
        // check entity token matches sell token
        address tokenAddress = dataAddress["token"];
        require(tokenAddress == _sellToken, "sell token must be entity token");

        // burn the unsold amount
        dataUint256["tokenSupply"] = dataUint256["tokenSupply"].sub(_unsoldAmount);
      }
    }    
  }

  // Internal functions

  function _transfer(address _from, address _to, uint256 _value) private {
    string memory fromKey = __a(_from, "tokenBalance");
    string memory toKey = __a(_to, "tokenBalance");

    require(dataUint256[fromKey] >= _value, 'not enough balance');

    dataUint256[fromKey] = dataUint256[fromKey].sub(_value);
    dataUint256[toKey] = dataUint256[toKey].add(_value);
  }
}

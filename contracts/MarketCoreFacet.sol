pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/IMarketCoreFacet.sol";
import "./base/IMarketObserver.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";
import "./base/SafeMath.sol";
import "./base/IERC20.sol";
import "./base/ReentrancyGuard.sol";

/**
 * Forked from https://github.com/nayms/maker-otc/blob/master/contracts/matching_market.sol
 */
contract MarketCoreFacet is EternalStorage, Controller, IDiamondFacet, IMarketCoreFacet, ReentrancyGuard {
  using SafeMath for uint256;

  modifier assertIsActive (uint256 _offerId) {
    require(dataBool[__i(_offerId, "isActive")], "offer not active");
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
      IMarketCoreFacet.executeLimitOffer.selector,
      IMarketCoreFacet.executeLimitOfferWithObserver.selector,
      IMarketCoreFacet.executeMarketOffer.selector,
      IMarketCoreFacet.buy.selector,
      IMarketCoreFacet.cancel.selector,
      IMarketCoreFacet.getBestOfferId.selector,
      IMarketCoreFacet.getLastOfferId.selector,
      IMarketCoreFacet.isActive.selector,
      IMarketCoreFacet.getOffer.selector
    );
  }

  // IMarketCoreFacet

  function isActive(uint256 _offerId) public view override returns (bool) {
    return dataBool[__i(_offerId, "isActive")];
  }

  function getOffer(uint256 _offerId) external view override returns ( 
    address creator_,
    address sellToken_, 
    uint256 sellAmount_, 
    address buyToken_, 
    uint256 buyAmount_,
    address notify_,
    bytes memory notifyData_,
    bool isActive_,
    uint256 nextOfferId_,
    uint256 prevOfferId_
  ) {
    creator_ = dataAddress[__i(_offerId, "creator")];
    sellToken_ = dataAddress[__i(_offerId, "sellToken")];
    sellAmount_ = dataUint256[__i(_offerId, "sellAmount")];
    buyToken_ = dataAddress[__i(_offerId, "buyToken")];
    buyAmount_ = dataUint256[__i(_offerId, "buyAmount")];
    notify_ = dataAddress[__i(_offerId, "notify")];
    notifyData_ = dataBytes[__i(_offerId, "notifyData")];
    isActive_ = dataBool[__i(_offerId, "isActive")];
    nextOfferId_ = dataUint256[__i(_offerId, "rankNext")];
    prevOfferId_ = dataUint256[__i(_offerId, "rankPrev")];
  }

  function getLastOfferId() external view override returns (uint256) {
    return dataUint256["lastOfferId"];
  }

  function getBestOfferId(address _sellToken, address _buyToken) public view override returns (uint256) {
    return dataUint256[__iaa(0, _sellToken, _buyToken, "bestOfferId")];
  }

  function cancel(uint256 _offerId) 
    assertIsActive(_offerId)
    nonReentrant
    external 
    override
  {
    address creator = dataAddress[__i(_offerId, "creator")];
    require(creator == msg.sender, "only creator can cancel");
    _cancel(_offerId);
  }

  function buy(uint256 _offerId, uint256 _amount) 
    assertIsActive(_offerId)
    nonReentrant
    external 
    override
  {
    _buy(_offerId, _amount);
  }

  function executeLimitOffer(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount
  ) 
    external
    override 
    returns (uint256) 
  {
    return executeLimitOfferWithObserver(
      _sellToken,
      _sellAmount,
      _buyToken,
      _buyAmount,
      address(0),
      ""
    );
  }

  function executeLimitOfferWithObserver(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount,
    address _notify,
    bytes memory _notifyData
  ) 
    nonReentrant
    public
    override 
    returns (uint256) 
  {
    _assertValidOffer(
      _sellToken,
      _sellAmount,
      _buyToken,
      _buyAmount
    );

    return _matchToExistingOffers(
      _sellToken,
      _sellAmount,
      _buyToken,
      _buyAmount,
      _notify,
      _notifyData
    );
  }

  function executeMarketOffer(address _sellToken, uint256 _sellAmount, address _buyToken) 
    nonReentrant
    external 
    override
  {
    _assertValidOffer(
      _sellToken,
      _sellAmount,
      _buyToken,
      1
    );

    uint256 sellAmount = _sellAmount;
    uint256 id;
    uint256 soldAmount;

    while (sellAmount > 0) {
      id = getBestOfferId(_buyToken, _sellToken);
      require(id != 0, "not enough orders in market");

      uint256 offerBuyAmount = dataUint256[__i(id, "buyAmount")];
      uint256 offerSellAmount = dataUint256[__i(id, "sellAmount")];

      // There is a chance that pay_amt is smaller than 1 wei of the other token
      if (sellAmount * 1 ether < wdiv(offerBuyAmount, offerSellAmount)) {
        break; // We consider that all amount is sold
      }

      // if sell amount >= offer buy amount then lets buy the whole offer
      if (sellAmount >= offerBuyAmount) {                       //If amount to sell is higher or equal than current offer amount to buy
        _buy(id, offerBuyAmount);
        soldAmount = soldAmount.add(offerBuyAmount);
        sellAmount = sellAmount.sub(offerBuyAmount);
      } 
      // otherwise, let's just buy what we can
      else {
        _buy(id, sellAmount);
        soldAmount = soldAmount.add(sellAmount);
        sellAmount = 0;
      }
    }

    // check that everything got sold
    require(soldAmount >= _sellAmount, "sale not fulfilled");
  }

  // Private
  
  function _insertOfferIntoSortedList(uint256 _offerId) private {
    // check that offer is NOT in the sorted list
    require(!_isOfferInSortedList(_offerId), "offer not in sorted list");

    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];
    
    uint256 prevId;

    // find position of next highest offer
    uint256 top = dataUint256[__iaa(0, sellToken, buyToken, "bestOfferId")];
    uint256 oldTop = 0;

    while (top != 0 && _isOfferPricedLtOrEq(_offerId, top)) {
      oldTop = top;
      top = dataUint256[__i(top, "rankPrev")];
    }

    uint256 pos = oldTop;

    // insert offer at position
    if (pos != 0) {
      prevId = dataUint256[__i(pos, "rankPrev")];
      dataUint256[__i(pos, "rankPrev")] = _offerId;
      dataUint256[__i(_offerId, "rankNext")] = pos;
    } 
    // else this is the new best offer, so insert at top
    else {
      prevId = dataUint256[__iaa(0, sellToken, buyToken, "bestOfferId")];
      dataUint256[__iaa(0, sellToken, buyToken, "bestOfferId")] = _offerId;
    }

    if (prevId != 0) {
      // requirement below is satisfied by statements above
      // require(!_isOfferPricedLtOrEq(_offerId, prevId));
      dataUint256[__i(prevId, "rankNext")] = _offerId;
      dataUint256[__i(_offerId, "rankPrev")] = prevId;
    }

    dataUint256[__iaa(0, sellToken, buyToken, "span")] += 1;
  }

  function _removeOfferFromSortedList(uint256 _offerId) private {
    // check that offer is in the sorted list
    require(_isOfferInSortedList(_offerId), "offer not in sorted list");

    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];

    require(dataUint256[__iaa(0, sellToken, buyToken, "span")] > 0, "token pair sorted list does not exist");

    // if offer is not the highest offer
    if (_offerId != dataUint256[__iaa(0, sellToken, buyToken, "bestOfferId")]) {
      uint256 nextId = dataUint256[__i(_offerId, "rankNext")];
      require(dataUint256[__i(nextId, "rankPrev")] == _offerId, "sort check failed");
      dataUint256[__i(nextId, "rankPrev")] = dataUint256[__i(_offerId, "rankPrev")];
    }
    // if offer is the highest offer
    else {
      dataUint256[__iaa(0, sellToken, buyToken, "bestOfferId")] = dataUint256[__i(_offerId, "rankPrev")];
    }

    // if offer is not the lowest offer
    if (dataUint256[__i(_offerId, "rankPrev")] != 0) {
      uint256 prevId = dataUint256[__i(_offerId, "rankPrev")];
      require(dataUint256[__i(prevId, "rankNext")] == _offerId, "sort check failed");
      dataUint256[__i(prevId, "rankNext")] = dataUint256[__i(_offerId, "rankNext")];
    }

    // nullify
    dataUint256[__i(_offerId, "rankNext")] = 0;
    dataUint256[__i(_offerId, "rankPrev")] = 0;

    dataUint256[__iaa(0, sellToken, buyToken, "span")] -= 1;
  }

  function _isOfferPricedLtOrEq(uint256 _lowOfferId, uint256 _highOfferId) private view returns (bool) {
    uint256 lowSellAmount = dataUint256[__i(_lowOfferId, "sellAmount")];
    uint256 lowBuyAmount = dataUint256[__i(_lowOfferId, "buyAmount")];

    uint256 highSellAmount = dataUint256[__i(_highOfferId, "sellAmount")];
    uint256 highBuyAmount = dataUint256[__i(_highOfferId, "buyAmount")];

    return lowBuyAmount.mul(highSellAmount) >= highBuyAmount.mul(lowSellAmount);
  }

  function _isOfferInSortedList(uint _offerId) private view returns(bool) {
    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];

    return dataUint256[__i(_offerId, "rankNext")] != 0 
      || dataUint256[__i(_offerId, "rankPrev")] != 0
      || dataUint256[__iaa(0, sellToken, buyToken, "bestOfferId")] == _offerId;
  }  

  function _matchToExistingOffers(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount,
    address _notify,
    bytes memory _notifyData
  ) 
    private 
    returns (uint256) 
  {
    uint256 buyAmount = _buyAmount;
    uint256 sellAmount = _sellAmount;

    // there is at least one offer stored for token pair
    uint256 bestOfferId = dataUint256[__iaa(0, _buyToken, _sellToken, "bestOfferId")];
    while (bestOfferId > 0) {
      uint256 bestBuyAmount = dataUint256[__i(bestOfferId, "buyAmount")];
      uint256 bestSellAmount = dataUint256[__i(bestOfferId, "sellAmount")];

      // Ugly hack to work around rounding errors. Based on the idea that
      // the furthest the amounts can stray from their "true" values is 1.
      // Ergo the worst case has `sellAmount` and `bestSellAmount` at +1 away from
      // their "correct" values and `bestBuyAmount` and `buyAmount` at -1.
      // Since (c - 1) * (d - 1) > (a + 1) * (b + 1) is equivalent to
      // c * d > a * b + a + b + c + d, we write...
      //
      // (For detailed breakdown see https://hiddentao.com/archives/2019/09/08/maker-otc-on-chain-orderbook-deep-dive)
      //
      if (bestBuyAmount.mul(buyAmount) > sellAmount.mul(bestSellAmount).add(bestBuyAmount).add(buyAmount).add(sellAmount).add(bestSellAmount)) {
        break;
      }

      // ^ The `rounding` parameter is a compromise borne of a couple days
      // of discussion.

      // avoid stack-too-deep
      {
        // do the buy     
        uint256 finalSellAmount = min(bestBuyAmount, sellAmount); 

        _buyWithObserver(
          bestOfferId, 
          finalSellAmount,
          _notify,
          _notifyData
        );

        // calculate how much is left to buy/sell
        uint256 sellAmountOld = sellAmount;
        sellAmount = sellAmount.sub(finalSellAmount);
        buyAmount = sellAmount.mul(buyAmount).div(sellAmountOld);
      }

      // if nothing left to sell or buy then we're done
      if (sellAmount == 0 || buyAmount == 0) {
        break;
      }

      bestOfferId = dataUint256[__iaa(0, _buyToken, _sellToken, "bestOfferId")];
    }

    // if still some left
    if (buyAmount > 0 && sellAmount > 0 && sellAmount >= dataUint256["dust"]) {
      // new offer should be created
      uint256 id = _createLimitOffer(
        _sellToken, 
        sellAmount, 
        _buyToken, 
        buyAmount,
        _notify,
        _notifyData
      );

      // ensure it's in the right position in the list
      _insertOfferIntoSortedList(id);

      return id;
    }

    return 0;
  }

  function _createLimitOffer(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount,
    address _notify,
    bytes memory _notifyData
  ) 
    private 
    returns (uint256) 
  {
    dataUint256["lastOfferId"] += 1;
    uint256 id = dataUint256["lastOfferId"];

    dataAddress[__i(id, "creator")] = msg.sender;
    dataAddress[__i(id, "sellToken")] = _sellToken;
    dataUint256[__i(id, "sellAmount")] = _sellAmount;
    dataAddress[__i(id, "buyToken")] = _buyToken;
    dataUint256[__i(id, "buyAmount")] = _buyAmount;
    dataAddress[__i(id, "notify")] = _notify;
    dataBytes[__i(id, "notifyData")] = _notifyData;
    dataBool[__i(id, "isActive")] = true;

    // escrow the tokens
    require(IERC20(_sellToken).transferFrom(msg.sender, address(this), _sellAmount), "unable to escrow tokens");

    return id;
  }

  function _buy(uint256 _offerId, uint256 _requestedBuyAmount) private {
    _buyWithObserver(_offerId, _requestedBuyAmount, address(0), "");
  }

  function _buyWithObserver(
    uint256 _offerId, 
    uint256 _requestedBuyAmount,
    address _buyNotify,
    bytes memory _buyNotifyData
  ) private {
    address creator = dataAddress[__i(_offerId, "creator")];
    address offerSellToken = dataAddress[__i(_offerId, "sellToken")];
    uint256 offerSellAmount = dataUint256[__i(_offerId, "sellAmount")];
    address offerBuyToken = dataAddress[__i(_offerId, "buyToken")];
    uint256 offerBuyAmount = dataUint256[__i(_offerId, "buyAmount")];

    // (a / b) * c = c * a / b  -> do multiplication first to avoid underflow
    uint256 thisSaleSellAmount = _requestedBuyAmount.mul(offerSellAmount).div(offerBuyAmount);

    require(uint128(_requestedBuyAmount) == _requestedBuyAmount, "buy amount exceeds int limit");    
    require(uint128(thisSaleSellAmount) == thisSaleSellAmount, "sell amount exceeds int limit");

    // check bounds
    _checkTradeBounds(offerBuyAmount, _requestedBuyAmount, offerSellAmount, thisSaleSellAmount);

    // update balances
    dataUint256[__i(_offerId, "sellAmount")] = offerSellAmount.sub(thisSaleSellAmount);
    dataUint256[__i(_offerId, "buyAmount")] = offerBuyAmount.sub(_requestedBuyAmount);

    // do the transfer
    require(IERC20(offerBuyToken).transferFrom(msg.sender, creator, _requestedBuyAmount), "sender -> creator transfer failed");
    require(IERC20(offerSellToken).transfer(msg.sender, thisSaleSellAmount), "market -> sender transfer failed");    

    // notify observers
    _notifyObserversOfTrade(_offerId, thisSaleSellAmount, _requestedBuyAmount, _buyNotify, _buyNotifyData);

    // cancel offer if it has become dust
    if (dataUint256[__i(_offerId, "sellAmount")] < dataUint256["dust"]) {
      _cancel(_offerId);
    }
  }

  function _notifyObserversOfTrade(
    uint256 _offerId,
    uint256 _soldAmount,
    uint256 _boughtAmount,
    address _buyNotify,
    bytes memory _buyNotifyData
  ) private {
    address creator = dataAddress[__i(_offerId, "creator")];
    address offerSellToken = dataAddress[__i(_offerId, "sellToken")];
    address offerBuyToken = dataAddress[__i(_offerId, "buyToken")];
    address offerNotify = dataAddress[__i(_offerId, "notify")];
    bytes memory offerNotifyData = dataBytes[__i(_offerId, "notifyData")];

    if (_buyNotify != address(0)) {
      IMarketObserver(_buyNotify).handleTrade(
        _offerId, 
        offerSellToken, 
        _soldAmount, 
        offerBuyToken, 
        _boughtAmount, 
        creator, 
        msg.sender, 
        _buyNotifyData
      );
    }

    if (offerNotify != address(0)) {
      IMarketObserver(offerNotify).handleTrade(
        _offerId, 
        offerSellToken, 
        _soldAmount, 
        offerBuyToken, 
        _boughtAmount, 
        creator, 
        msg.sender, 
        offerNotifyData
      );
    }
  }

  function _checkTradeBounds(uint256 _maxBuyAmount, uint256 _buyAmount, uint256 _maxSellAmount, uint256 _sellAmount) private {
    require(_buyAmount > 0, "requested buy amount is 0");
    require(_buyAmount <= _maxBuyAmount, "requested buy amount too large");
    require(_sellAmount > 0, "calculated sell amount is 0");
    require(_sellAmount <= _maxSellAmount, "calculated sell amount too large");
  }

  function _cancel(uint256 _offerId) private {
    if (_isOfferInSortedList(_offerId)) {
      _removeOfferFromSortedList(_offerId);
    }

    address creator = dataAddress[__i(_offerId, "creator")];
    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    uint256 sellAmount = dataUint256[__i(_offerId, "sellAmount")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];
    uint256 buyAmount = dataUint256[__i(_offerId, "buyAmount")];
    address notify = dataAddress[__i(_offerId, "notify")];
    bytes memory notifyData = dataBytes[__i(_offerId, "notifyData")];

    // transfer remaining sell amount back to creator
    if (sellAmount > 0) {
      require(IERC20(sellToken).transfer(creator, sellAmount));
    }

    // notify observers
    if (notify != address(0)) {
      IMarketObserver(notify).handleClosure(
        _offerId, 
        sellToken, 
        sellAmount, 
        buyToken, 
        buyAmount, 
        creator, 
        notifyData
      );
    }

    dataBool[__i(_offerId, "isActive")] = false;
  }

  function _assertValidOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) private {
    require(uint128(_sellAmount) == _sellAmount, "sell amount must be uint128");
    require(uint128(_buyAmount) == _buyAmount, "buy amount must be uint128");
    require(_sellAmount > 0, "sell amount must be greater than 0");
    require(_sellToken != address(0), "sell token must be valid");
    require(_buyAmount > 0, "buy amount must be greater than 0");
    require(_buyToken != address(0), "buy token must be valid");
    require(_sellToken != _buyToken, "sell token and buy token must be different");
  }

  // These are from https://github.com/nayms/maker-otc/blob/master/contracts/math.sol
  function wdiv(uint x, uint y) private pure returns (uint z) {
    z = SafeMath.add(SafeMath.mul(x, (10 ** 18)), y.div(2)).div(y);
  }
  function min(uint x, uint y) private pure returns (uint z) {
    z = (x < y ? x : y);
  }
}

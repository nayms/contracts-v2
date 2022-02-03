// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/IMarketCoreFacet.sol";
import "./base/IMarketObserver.sol";
import "./base/IMarketOfferStates.sol";
import "./base/IParent.sol";
import "./base/IChild.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";
import "./base/SafeMath.sol";
import "./base/IERC20.sol";
import "./base/ReentrancyGuard.sol";
import "./MarketFacetBase.sol";

/**
 * Forked from https://github.com/nayms/maker-otc/blob/master/contracts/matching_market.sol
 */
contract MarketCoreFacet is EternalStorage, Controller, MarketFacetBase, IDiamondFacet, IMarketCoreFacet, IMarketOfferStates, ReentrancyGuard {
  using SafeMath for uint256;

  modifier assertIsActive (uint256 _offerId) {
    require(dataUint256[__i(_offerId, "state")] == OFFER_STATE_ACTIVE, "offer not active");
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
      IMarketCoreFacet.executeMarketOffer.selector,
      IMarketCoreFacet.buy.selector,
      IMarketCoreFacet.cancel.selector
    );
  }

  // IMarketCoreFacet

  function cancel(uint256 _offerId) 
    assertIsActive(_offerId)
    nonReentrant
    external 
    override
  {
    address creator = dataAddress[__i(_offerId, "creator")];
    require(creator == msg.sender, "only creator can cancel");
    dataUint256[__i(_offerId, "state")] = OFFER_STATE_CANCELLED;
    _cancel(_offerId);
  }

  function buy(uint256 _offerId, uint256 _amount) 
    assertIsActive(_offerId)
    nonReentrant
    external 
    override
  {
    _buyWithObserver(_offerId, _amount, address(0), "");
  }

  function executeLimitOffer(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount,
    uint256 _feeSchedule,
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
      _buyAmount,
      _feeSchedule
    );

    _calculateFee(
      _sellToken,
      _sellAmount,
      _buyToken,
      _buyAmount,
      _feeSchedule
    );

    uint256 remainingBuyAmount_;
    uint256 remainingSellAmount_;

    (remainingBuyAmount_, remainingSellAmount_) = _matchToExistingOffers(
      _sellToken,
      _sellAmount,
      _buyToken,
      _buyAmount,
      _notify,
      _notifyData
    );

    // if still some left
    if (remainingBuyAmount_ > 0 
      && remainingSellAmount_ > 0 
      && remainingSellAmount_ >= dataUint256["dust"]
    ) {
      // new offer should be created
      uint256 id = _createOffer(
        _sellToken, 
        remainingSellAmount_, 
        _buyToken, 
        remainingBuyAmount_,
        _feeSchedule,
        _notify,
        _notifyData,
        false
      );

      // ensure it's in the right position in the list
      _insertOfferIntoSortedList(id);

      return id;
    }

    return 0; // no limit offer created, fully matched
  }

  function executeMarketOffer(address _sellToken, uint256 _sellAmount, address _buyToken) 
    nonReentrant
    external 
    override 
    returns (uint256)
  {
    _assertValidOffer(
      _sellToken,
      _sellAmount,
      _buyToken,
      1,
      FEE_SCHEDULE_STANDARD
    );

    uint256 sellAmount = _sellAmount;
    uint256 id;
    uint256 soldAmount;

    while (sellAmount > 0) {
      id = _getBestOfferId(_buyToken, _sellToken);
      require(id != 0, "not enough orders in market");

      uint256 offerBuyAmount = dataUint256[__i(id, "buyAmount")];
      uint256 offerSellAmount = dataUint256[__i(id, "sellAmount")];

      // There is a chance that pay_amt is smaller than 1 wei of the other token
      if (sellAmount * 1 ether < wdiv(offerBuyAmount, offerSellAmount)) {
        break; // We consider that all amount is sold
      }

      // if sell amount >= offer buy amount then lets buy the whole offer
      if (sellAmount >= offerBuyAmount) {
        _buyWithObserver(id, offerBuyAmount, address(0), "");
        soldAmount = soldAmount.add(offerBuyAmount);
        sellAmount = sellAmount.sub(offerBuyAmount);
      } 
      // otherwise, let's just buy what we can
      else {
        _buyWithObserver(id, sellAmount, address(0), "");
        soldAmount = soldAmount.add(sellAmount);
        sellAmount = 0;
      }
    }

    // check that everything got sold
    require(soldAmount >= _sellAmount, "sale not fulfilled");

    return _createOffer(
      _sellToken, 
      _sellAmount, 
      _buyToken, 
      0,
      FEE_SCHEDULE_STANDARD,
      msg.sender,
      "",
      true
    );
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
    returns (uint256 remainingBuyAmount_, uint256 remainingSellAmount_) 
  {
    remainingBuyAmount_ = _buyAmount;
    remainingSellAmount_ = _sellAmount;

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
      if (bestBuyAmount.mul(remainingBuyAmount_) > remainingSellAmount_.mul(bestSellAmount).add(bestBuyAmount).add(remainingBuyAmount_).add(remainingSellAmount_).add(bestSellAmount)) {
        break;
      }

      // ^ The `rounding` parameter is a compromise borne of a couple days
      // of discussion.

      // avoid stack-too-deep
      {

        uint256 finalSellAmount = bestBuyAmount < remainingSellAmount_ ? bestBuyAmount : remainingSellAmount_; 

        _buyWithObserver(
          bestOfferId, 
          finalSellAmount,
          _notify,
          _notifyData
        );

        // calculate how much is left to buy/sell
        uint256 sellAmountOld = remainingSellAmount_;
        remainingSellAmount_ = remainingSellAmount_.sub(finalSellAmount);
        remainingBuyAmount_ = remainingSellAmount_.mul(remainingBuyAmount_).div(sellAmountOld);
      }

      // if nothing left to sell or buy then we're done
      if (remainingSellAmount_ == 0 || remainingBuyAmount_ == 0) {
        break;
      }

      bestOfferId = dataUint256[__iaa(0, _buyToken, _sellToken, "bestOfferId")];
    }
  }

  function _createOffer(
    address _sellToken, 
    uint256 _sellAmount, 
    address _buyToken, 
    uint256 _buyAmount,
    uint256 _feeSchedule,
    address _notify,
    bytes memory _notifyData,
    bool marketOffer
  ) 
    private 
    returns (uint256) 
  {
    dataUint256["lastOfferId"] += 1;
    uint256 id = dataUint256["lastOfferId"];

    dataAddress[__i(id, "creator")] = msg.sender;
    dataAddress[__i(id, "sellToken")] = _sellToken;
    dataUint256[__i(id, "sellAmount")] = _sellAmount;
    dataUint256[__i(id, "sellAmountInitial")] = _sellAmount;
    dataAddress[__i(id, "buyToken")] = _buyToken;
    dataUint256[__i(id, "buyAmount")] = _buyAmount;
    dataUint256[__i(id, "buyAmountInitial")] = _buyAmount;
    dataUint256[__i(id, "feeSchedule")] = _feeSchedule;
    dataAddress[__i(id, "notify")] = _notify;
    dataBytes[__i(id, "notifyData")] = _notifyData;

    if(marketOffer) {
      dataUint256[__i(id, "state")] = OFFER_STATE_FULFILLED;
    } else {
      dataUint256[__i(id, "state")] = OFFER_STATE_ACTIVE;
      // escrow the tokens for limit offers,
      // market offers are only created for historical reasons, so no need to escrow
      require(IERC20(_sellToken).transferFrom(msg.sender, address(this), _sellAmount), "unable to escrow tokens");
    }

    return id;
  }

  function _buyWithObserver(
    uint256 _offerId, 
    uint256 _requestedBuyAmount,
    address _buyNotify,
    bytes memory _buyNotifyData
  ) private {
    (TokenAmount memory offerSell, TokenAmount memory offerBuy) = _getOfferTokenAmounts(_offerId);

    // (a / b) * c = c * a / b  -> do multiplication first to avoid underflow
    uint256 thisSaleSellAmount = _requestedBuyAmount.mul(offerSell.amount).div(offerBuy.amount);

    // check bounds and update balances
    _checkBoundsAndUpdateBalances(_offerId, thisSaleSellAmount, _requestedBuyAmount);

    // calculate and take out fees
    (
      uint256 finalSellAmount,
      TokenAmount memory fee
    ) = _takeFees(      
      offerBuy.token,
      _requestedBuyAmount,
      offerSell.token,
      thisSaleSellAmount,
      dataUint256[__i(_offerId, "feeSchedule")]
    );

    // do the transfer
    require(IERC20(offerBuy.token).transferFrom(msg.sender, dataAddress[__i(_offerId, "creator")], _requestedBuyAmount), "sender -> creator transfer failed");
    require(IERC20(offerSell.token).transfer(msg.sender, finalSellAmount), "market -> sender transfer failed");    

    // notify observers
    _notifyObserversOfTrade(
      _offerId, 
      thisSaleSellAmount, 
      _requestedBuyAmount, 
      fee,
      _buyNotify, 
      _buyNotifyData
    );

    // cancel offer if it has become dust
    if (dataUint256[__i(_offerId, "sellAmount")] < dataUint256["dust"]) {
      dataUint256[__i(_offerId, "state")] = OFFER_STATE_FULFILLED;
      _cancel(_offerId);
    }
  }

  function _checkBoundsAndUpdateBalances(uint256 _offerId, uint256 _sellAmount, uint256 _buyAmount) private {
    (TokenAmount memory offerSell, TokenAmount memory offerBuy) = _getOfferTokenAmounts(_offerId);

    require(uint128(_buyAmount) == _buyAmount, "buy amount exceeds int limit");    
    require(uint128(_sellAmount) == _sellAmount, "sell amount exceeds int limit");

    require(_buyAmount > 0, "requested buy amount is 0");
    require(_buyAmount <= offerBuy.amount, "requested buy amount too large");
    require(_sellAmount > 0, "calculated sell amount is 0");
    require(_sellAmount <= offerSell.amount, "calculated sell amount too large");

    // update balances
    dataUint256[__i(_offerId, "sellAmount")] = offerSell.amount.sub(_sellAmount);
    dataUint256[__i(_offerId, "buyAmount")] = offerBuy.amount.sub(_buyAmount);
  }

  function _takeFees(
    address _buyToken, 
    uint256 _buyAmount, 
    address _sellToken, 
    uint256 _sellAmount,
    uint256 _feeSchedule
  ) private 
    returns (uint256 finalSellAmount_, TokenAmount memory fee_)
  {
    address feeBank = _getFeeBank();
    
    finalSellAmount_ = _sellAmount;

    fee_ = _calculateFee(_buyToken, _buyAmount, _sellToken, _sellAmount, _feeSchedule);

    if (fee_.token == _buyToken) {
      // if fee is to be paid in the buy token then it must be paid on top of buy amount
      require(IERC20(_buyToken).transferFrom(msg.sender, feeBank, fee_.amount), "sender -> feebank fee transfer failed");
    } else {
      // if fee is to be paid in the sell token then it must be paid from the received amount
      finalSellAmount_ = finalSellAmount_.sub(fee_.amount);
      require(IERC20(_sellToken).transfer(feeBank, fee_.amount), "market -> feebank fee transfer failed");    
    }
  }

  function _notifyObserversOfTrade(
    uint256 _offerId,
    uint256 _soldAmount,
    uint256 _boughtAmount,
    TokenAmount memory _fee,
    address _buyNotify,
    bytes memory _buyNotifyData
  ) private {
    address offerNotify = dataAddress[__i(_offerId, "notify")];
    bytes memory offerNotifyData = dataBytes[__i(_offerId, "notifyData")];

    if (_buyNotify != address(0)) {
      IMarketObserver(_buyNotify).handleTrade(
        _offerId, 
        _soldAmount, 
        _boughtAmount, 
        _fee.token,
        _fee.amount,
        msg.sender, 
        _buyNotifyData
      );
    }

    if (offerNotify != address(0)) {
      IMarketObserver(offerNotify).handleTrade(
        _offerId, 
        _soldAmount, 
        _boughtAmount, 
        _fee.token,
        _fee.amount,
        msg.sender, 
        offerNotifyData
      );
    }
  }

  function _cancel(uint256 _offerId) private {
    if (_isOfferInSortedList(_offerId)) {
      _removeOfferFromSortedList(_offerId);
    }

    address creator = dataAddress[__i(_offerId, "creator")];
    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    uint256 sellAmount = dataUint256[__i(_offerId, "sellAmount")];
    uint256 buyAmount = dataUint256[__i(_offerId, "buyAmount")];
    address notify = dataAddress[__i(_offerId, "notify")];
    bytes memory notifyData = dataBytes[__i(_offerId, "notifyData")];

    // transfer remaining sell amount back to creator
    if (sellAmount > 0) {
      require(IERC20(sellToken).transfer(creator, sellAmount), "refund creator failed");
    }

    // notify observers
    if (notify != address(0)) {
      IMarketObserver(notify).handleClosure(
        _offerId, 
        sellAmount, 
        buyAmount, 
        notifyData
      );
    }
  }

  function _assertValidOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount, uint256 _feeSchedule) private view {
    require(uint128(_sellAmount) == _sellAmount, "sell amount must be uint128");
    require(uint128(_buyAmount) == _buyAmount, "buy amount must be uint128");
    require(_sellAmount > 0, "sell amount must be >0");
    require(_sellToken != address(0), "sell token must be valid");
    require(_buyAmount > 0, "buy amount must be >0");
    require(_buyToken != address(0), "buy token must be valid");
    require(_sellToken != _buyToken, "cannot sell and buy same token");

    // if caller requested the 'platform action' fee schedule then check that they're allowed to do so
    if (_feeSchedule == FEE_SCHEDULE_PLATFORM_ACTION) {
      // get and check parent
      address parent = IChild(msg.sender).getParent();
      require(IParent(parent).hasChild(msg.sender), "fee schedule: bad parent");

      // get entity deployer
      address entityDeployer = settings().getRootAddress(SETTING_ENTITY_DEPLOYER);

      // if parent is NOT the entity deployer then the grandparent must be
      if (parent != entityDeployer) {
        // the caller must be a policy, in which case let's goto the grandparent
        address grandparent = IChild(parent).getParent();
        require(IParent(grandparent).hasChild(parent), "fee schedule: bad grandparent");
        require(grandparent == entityDeployer, "fee schedule: bad deployment");
      }
    }
  }
}

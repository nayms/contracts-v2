pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/IMarketCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";
import "./base/SafeMath.sol";
import "./base/ReentrancyGuard.sol";

/**
 * Forked from https://github.com/nayms/maker-otc/blob/master/contracts/matching_market.sol
 */
contract MarketCoreFacet is EternalStorage, Controller, IDiamondFacet, IMarketCoreFacet, ReentrancyGuard {
  using SafeMath for *;

  modifier assertIsActive (uint256 _offerId) {
    require(dataBool[__i(_offerId, "isActive")], "offer not active");
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
    // nothing
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IMarketCoreFacet.createLimitOffer.selector,
      IMarketCoreFacet.executeMarketOffer.selector,
      IMarketCoreFacet.cancel.selector,
      IMarketCoreFacet.getLastOfferId.selector,
      IMarketCoreFacet.isActive.selector,
      IMarketCoreFacet.getOffer.selector
    );
  }

  // IMarketCoreFacet

  function isActive(uint256 _offerId) external view returns (bool) {
    return dataBool[__i(_offerId, "isActive")];
  }

  function getOffer(uint256 _offerId) external view returns ( 
    address creator_,
    address sellToken_, 
    uint256 sellAmount_, 
    address buyToken_, 
    uint256 buyAmount_,
    bool isActive_
  ) {
    creator_ = dataAddress[__i(_offerId, "creator")];
    sellToken_ = dataAddress[__i(_offerId, "sellToken")];
    sellAmount_ = dataUint256[__i(_offerId, "sellAmount")];
    buyToken_ = dataAddress[__i(_offerId, "buyToken")];
    buyAmount_ = dataAddress[__i(_offerId, "buyAmount")];
    isActive_ = dataBool[__i(_offerId, "isActive")];
  }

  function getLastOfferId() external view returns (uint256) {
    return dataUint256["lastOfferId"];
  }

  function cancel(uint256 _offerId) 
    assertIsActive(_offerId)
    nonReentrant
    external 
  {
    address creator = dataAddress[__i(_offerId, "creator")];
    require(creator === msg.sender, "only creator can cancel");
    _cancel(_offerId);
  }

  function createLimitOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) 
    nonReentrant
    external 
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
      _buyAmount
    )
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
      top = dataUint256[__i(_top, "rankPrev")];
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
    require(dataUint256[__iaa(0, sellToken, buyToken, "span")] > 0, "sorted list does not exist");

    // check that offer is still in the sorted list
    require(_isOfferInSortedList(_offerId), "offer not in sorted list");

    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];

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
    uint256 lowBuyAmount = dataAddress[__i(_lowOfferId, "buyAmount")];

    uint256 highSellAmount = dataUint256[__i(_highOfferId, "sellAmount")];
    uint256 highBuyAmount = dataAddress[__i(_highOfferId, "buyAmount")];

    return lowBuyAmount.mul(highSellAmount) >= highBuyAmount.mul(lowSellAmount);
  }

  function _isOfferInSortedList(uint _offerId) private view returns(bool) {
    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];

    return dataUint256[__i(_offerId, "rankNext")] != 0 
      || dataUint256[__i(_offerId, "rankPrev")] != 0
      || dataUint256[__iaa(0, sellToken, buyToken, "bestOfferId")] == _offerId;
  }  

  function _matchToExistingOffers(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) 
    private 
    returns (uint256) 
  {
    uint256 buyAmount = _buyAmount;
    uint256 sellAmount = _sellAmount;

    // there is at least one offer stored for token pair
    uint256 bestOfferId = dataUint256[__iaa(0, _buyToken, _sellToken, "bestOfferId")];
    while (bestOfferId > 0) {
      uint256 bestBuyAmount = dataUint256[__id(bestOfferId, "buyAmount")];
      uint256 bestSellAmount = dataUint256[__id(bestOfferId, "sellAmount")];

      // Ugly hack to work around rounding errors. Based on the idea that
      // the furthest the amounts can stray from their "true" values is 1.
      // Ergo the worst case has `sellAmount` and `bestSellAmount` at +1 away from
      // their "correct" values and `bestBuyAmount` and `buyAmount` at -1.
      // Since (c - 1) * (d - 1) > (a + 1) * (b + 1) is equivalent to
      // c * d > a * b + a + b + c + d, we write...
      if (bestBuyAmount.mul(buyAmount) > sellAmount.mul(bestSellAmount).add(bestBuyAmount).add(buyAmount).add(sellAmount).add(bestSellAmount)) {
        break;
      }

      // ^ The `rounding` parameter is a compromise borne of a couple days
      // of discussion.

      // do the buy      
      _buy(bestOfferId, min(bestSellAmount, _buyAmount));

      buyAmountOld = buyAmount;
      buyAmount = buyAmount.sub(bestSellAmount.mul(buyAmount));
      sellAmount = buyAmount.mul(sellAmount).div(buyAmountOld);

      // if nothing to sell or buy then we're done
      if (sellAmount == 0 || buyAmount == 0) {
        break;
      }

      bestOfferId = dataUint256[__iaa(0, _buyToken, _sellToken, "bestOfferId")];
    }

    // if still some left
    if (buyAmount > 0 && sellAmount > 0 && sellAmount >= dataUint256[__a(_sellToken, "dust")]) {
      // new offer should be created
      id = _createLimitOffer(_sellToken, sellAmount, _buyToken, buyAmount);

      // ensure it's in the right position in the list
      _insertOfferIntoSortedList(id);

      return id;
    }

    return 0;
  }

  function _createLimitOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) 
    private 
    returns (uint256) 
  {
    dataUint256["lastOfferId"] += 1;
    uint256 id = dataUint256["lastOfferId"];

    dataAddress[__i(id, "creator")] = msg.sender;
    dataAddress[__i(id, "sellToken")] = _sellToken;
    dataUint256[__i(id, "sellAmount")] = _sellAmount;
    dataAddress[__i(id, "buyToken")] = _buyToken;
    dataAddress[__i(id, "buyAmount")] = _buyAmount;
    dataBool[__i(id, "isActive")] = true;

    return id;
  }

  function _buy(uint256 _offerid, _amount) private {
    uint256 offerSellToken = dataUint256[__i(_offerid, "sellToken")];
    uint256 offerSellAmount = dataUint256[__i(_offerid, "sellAmount")];

    if (offerSellAmount == _amount) {
      // remove from sorted list
      _removeOfferFromSortedList(_offerId);
      
      // do the buy
      _executeBuy(_offerId, _amount);

      // If offer has become dust during buy, we cancel it
      if (isActive(id) && offerSellAmount < dataUint256[__a(offerSellToken, "dust")]) {
        dataUint256["lastDustOfferId"] = _offerId;
        _cancel(_offerId);
      }
  }

  function _executeBuy(uint256 _offerId, uint256 _amount) private 
  {
    address creator = dataAddress[__i(_offerId, "creator")];
    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    uint256 sellAmount = dataUint256[__i(_offerId, "sellAmount")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];
    uint256 buyAmount = dataAddress[__i(_offerId, "buyAmount")];

    uint spend = _amount.mul(buyAmount).div(sellAmount);

    require(uint128(spend) == spend);
    require(uint128(_amount) == _amount);    

    // For backwards semantic compatibility.
    if (_amount == 0 || spend == 0 || _amount > sellAmount || spend > buyAmount) {
      return;
    }

    // do the transfer
    dataUint256[__i(_offerId, "sellAmount")] = sellAmount.sub(_amount);
    dataAddress[__i(_offerId, "buyAmount")] = buyAmount.sub(spend);
    require(IERC20(buyToken).transferFrom(msg.sender, creator, spend));
    require(IERC20(sellToken).transfer(msg.sender, _amount));    

    // mark offer as no longer active if necessary
    if (dataUint256[__i(_offerId, "sellAmount")] == 0) {
      dataBool[__i(_offerId, "isActive")] = false;
    }
  }

  function _cancel(uint256 _offerId) private {
    if (_isOfferInSortedList(_offerId)) {
      _removeOfferFromSortedList(_offerId);
    }

    address creator = dataAddress[__i(_offerId, "creator")];
    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    uint256 sellAmount = dataUint256[__i(_offerId, "sellAmount")];

    require(IERC20(sellToken).transfer(creator, sellAmount));

    dataBool[__i(_offerId, "isActive")] = false;
  }

  function _assertValidOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) private {
    require(uint128(_sellAmount) == _sellAmount);
    require(uint128(_buyAmount) == _buyAmount);
    require(_sellAmount > 0);
    require(_sellToken != address(0));
    require(_buyAmount > 0);
    require(_buyToken != address(0));
    require(_sellToken != _buyToken);
  }
}

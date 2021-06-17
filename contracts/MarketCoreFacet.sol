pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/IMarketCoreFacet.sol";
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
    /*
    * Minimum sell amount for a token - used to avoid "dust" offers that have very small amount of tokens to sell whereby it
    * would cost more gas to accept the offer than the value of the tokens received
    */
    dataUint256["dust"] = 1000000000;
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IMarketCoreFacet.executeLimitOffer.selector,
      IMarketCoreFacet.executeMarketOffer.selector,
      IMarketCoreFacet.cancel.selector,
      IMarketCoreFacet.getBestOffer.selector,
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
    bool isActive_
  ) {
    creator_ = dataAddress[__i(_offerId, "creator")];
    sellToken_ = dataAddress[__i(_offerId, "sellToken")];
    sellAmount_ = dataUint256[__i(_offerId, "sellAmount")];
    buyToken_ = dataAddress[__i(_offerId, "buyToken")];
    buyAmount_ = dataUint256[__i(_offerId, "buyAmount")];
    isActive_ = dataBool[__i(_offerId, "isActive")];
  }

  function getLastOfferId() external view override returns (uint256) {
    return dataUint256["lastOfferId"];
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

  function getBestOffer(address _sellToken, address _buyToken) public view override returns (uint256) {
    return dataUint256[__iaa(0, _sellToken, _buyToken, "bestOfferId")];
  }

  function executeLimitOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) 
    nonReentrant
    external
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
      _buyAmount
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
    uint256 fillAmount;

    while (sellAmount > 0) {
      id = getBestOffer(_buyToken, _sellToken);
      require(id != 0, "not enough orders in market");

      uint256 offerBuyAmount = dataUint256[__i(id, "buyAmount")];
      uint256 offerSellAmount = dataUint256[__i(id, "sellAmount")];

      // There is a chance that pay_amt is smaller than 1 wei of the other token
      if (sellAmount * 1 ether < wdiv(offerBuyAmount, offerSellAmount)) {
          break; // We consider that all amount is sold
      }

      // if greater then buy whole offer
      if (sellAmount >= offerBuyAmount) {                       //If amount to sell is higher or equal than current offer amount to buy
        fillAmount = fillAmount.add(offerSellAmount);
        sellAmount = sellAmount.sub(offerBuyAmount);
        _buy(id, sellAmount);
      } 
      // if lower then buy as much as possible of offer
      else {
        uint256 baux = rmul(sellAmount.mul(10 ** 9), rdiv(offerSellAmount, offerBuyAmount)).div(10 ** 9);
        fillAmount = fillAmount.add(baux);
        _buy(id, baux);
        sellAmount = 0;
      }
    }

    // check that everything got sold
    require(fillAmount >= _sellAmount, "sale not fulfilled");
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
    // check that offer is still in the sorted list
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

  function _matchToExistingOffers(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) 
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
      if (bestBuyAmount.mul(buyAmount) > sellAmount.mul(bestSellAmount).add(bestBuyAmount).add(buyAmount).add(sellAmount).add(bestSellAmount)) {
        break;
      }

      // ^ The `rounding` parameter is a compromise borne of a couple days
      // of discussion.

      // do the buy      
      _buy(bestOfferId, min(bestSellAmount, buyAmount));

      uint256 buyAmountOld = buyAmount;
      buyAmount = buyAmount.sub(bestSellAmount.mul(buyAmount));
      sellAmount = buyAmount.mul(sellAmount).div(buyAmountOld);

      // if nothing to sell or buy then we're done
      if (sellAmount == 0 || buyAmount == 0) {
        break;
      }

      bestOfferId = dataUint256[__iaa(0, _buyToken, _sellToken, "bestOfferId")];
    }

    // if still some left
    if (buyAmount > 0 && sellAmount > 0 && sellAmount >= dataUint256["dust"]) {
      // new offer should be created
      uint256 id = _createLimitOffer(_sellToken, sellAmount, _buyToken, buyAmount);

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
    dataUint256[__i(id, "buyAmount")] = _buyAmount;
    dataBool[__i(id, "isActive")] = true;

    return id;
  }

  function _buy(uint256 _offerId, uint256 _amount) private {
    uint256 offerSellToken = dataUint256[__i(_offerId, "sellToken")];
    uint256 offerSellAmount = dataUint256[__i(_offerId, "sellAmount")];

    if (offerSellAmount == _amount) {
      // remove from sorted list
      _removeOfferFromSortedList(_offerId);
      
      // do the buy
      _executeBuy(_offerId, _amount);

      // if offer has become dust during buy, we cancel it
      if (isActive(_offerId) && offerSellAmount < dataUint256["dust"]) {
        dataUint256["lastDustOfferId"] = _offerId;
        _cancel(_offerId);
      }
    }
  }

  function _executeBuy(uint256 _offerId, uint256 _amount) private {
    address creator = dataAddress[__i(_offerId, "creator")];
    address sellToken = dataAddress[__i(_offerId, "sellToken")];
    uint256 sellAmount = dataUint256[__i(_offerId, "sellAmount")];
    address buyToken = dataAddress[__i(_offerId, "buyToken")];
    uint256 buyAmount = dataUint256[__i(_offerId, "buyAmount")];

    uint spend = _amount.mul(buyAmount).div(sellAmount);

    require(uint128(spend) == spend);
    require(uint128(_amount) == _amount);    

    // For backwards semantic compatibility.
    if (_amount == 0 || spend == 0 || _amount > sellAmount || spend > buyAmount) {
      return;
    }

    // do the transfer
    dataUint256[__i(_offerId, "sellAmount")] = sellAmount.sub(_amount);
    dataUint256[__i(_offerId, "buyAmount")] = buyAmount.sub(spend);
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

  // These are from https://github.com/nayms/maker-otc/blob/master/contracts/math.sol
  function rmul(uint x, uint y) private pure returns (uint z) {
    z = SafeMath.add(SafeMath.mul(x, y), (10 ** 27) / 2).div(10 ** 27);
  }
  function wdiv(uint x, uint y) private pure returns (uint z) {
    z = SafeMath.add(SafeMath.mul(x, (10 ** 18)), y.div(2)).div(y);
  }
  function rdiv(uint x, uint y) private pure returns (uint z) {
    z = SafeMath.add(SafeMath.mul(x, (10 ** 27)), y.div(2)).div(y);
  }
  function min(uint x, uint y) private pure returns (uint z) {
    z = (x < y ? x : y);
  }
}

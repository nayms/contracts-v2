// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/EternalStorage.sol";
import "./base/IMarketDataFacet.sol";
import "./base/IMarketOfferStates.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";
import "./MarketFacetBase.sol";

contract MarketDataFacet is EternalStorage, Controller, MarketFacetBase, IDiamondFacet, IMarketDataFacet, IMarketOfferStates {
    /**
     * Constructor
     */
    constructor(address _settings) Controller(_settings) {}

    // IDiamondFacet

    function getSelectors() public pure override returns (bytes memory) {
        return
            abi.encodePacked(
                IMarketDataFacet.setFee.selector,
                IMarketDataFacet.getConfig.selector,
                IMarketDataFacet.getBestOfferId.selector,
                IMarketDataFacet.getLastOfferId.selector,
                IMarketDataFacet.isActive.selector,
                IMarketDataFacet.getOffer.selector,
                IMarketDataFacet.getOfferSiblings.selector,
                IMarketDataFacet.calculateFee.selector,
                IMarketDataFacet.simulateMarketOffer.selector
            );
    }

    // IMarketDataFacet

    function getConfig() external view override returns (uint256 dust_, uint256 feeBP_) {
        dust_ = dataUint256["dust"];
        feeBP_ = dataUint256["feeBP"];
    }

    function setFee(uint256 _feeBP) external override assertIsAdmin {
        dataUint256["feeBP"] = _feeBP;
    }

    function isActive(uint256 _offerId) external view override returns (bool) {
        return dataUint256[__i(_offerId, "state")] == OFFER_STATE_ACTIVE;
    }

    function getOffer(uint256 _offerId) external view override returns (IMarketDataFacet.OfferState memory _offerState) {
        _offerState.creator = dataAddress[__i(_offerId, "creator")];
        _offerState.sellToken = dataAddress[__i(_offerId, "sellToken")];
        _offerState.buyToken = dataAddress[__i(_offerId, "buyToken")];

        _offerState.sellAmountInitial = dataUint256[__i(_offerId, "sellAmountInitial")];
        _offerState.sellAmount = dataUint256[__i(_offerId, "sellAmount")];
        uint256 soldAmount = _offerState.sellAmountInitial - _offerState.sellAmount;

        _offerState.buyAmount = dataUint256[__i(_offerId, "buyAmount")];
        _offerState.averagePrice = soldAmount > 0 ? _offerState.buyAmount / soldAmount : 0;

        _offerState.buyAmountInitial = dataUint256[__i(_offerId, "buyAmountInitial")];
        _offerState.feeSchedule = dataUint256[__i(_offerId, "feeSchedule")];
        _offerState.notify = dataAddress[__i(_offerId, "notify")];
        _offerState.notifyData = dataBytes[__i(_offerId, "notifyData")];
        _offerState.state = dataUint256[__i(_offerId, "state")];
    }

    function getOfferSiblings(uint256 _offerId) external view override returns (uint256 nextOfferId_, uint256 prevOfferId_) {
        nextOfferId_ = dataUint256[__i(_offerId, "rankNext")];
        prevOfferId_ = dataUint256[__i(_offerId, "rankPrev")];
    }

    function getLastOfferId() external view override returns (uint256) {
        return dataUint256["lastOfferId"];
    }

    function getBestOfferId(address _sellToken, address _buyToken) public view override returns (uint256) {
        return _getBestOfferId(_sellToken, _buyToken);
    }

    function calculateFee(
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken,
        uint256 _buyAmount,
        uint256 _feeSchedule
    ) external view override returns (address feeToken_, uint256 feeAmount_) {
        TokenAmount memory fee = _calculateFee(_sellToken, _sellAmount, _buyToken, _buyAmount, _feeSchedule);
        return (fee.token, fee.amount);
    }

    function simulateMarketOffer(
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken
    ) external view override returns (uint256) {
        uint256 boughtAmount_;
        uint256 soldAmount_;
        uint256 sellAmount = _sellAmount;

        uint256 bestOfferId = dataUint256[__iaa(0, _buyToken, _sellToken, "bestOfferId")];

        while (sellAmount > 0 && bestOfferId > 0) {
            uint256 offerBuyAmount = dataUint256[__i(bestOfferId, "buyAmount")];
            uint256 offerSellAmount = dataUint256[__i(bestOfferId, "sellAmount")];

            // There is a chance that pay_amt is smaller than 1 wei of the other token
            if (sellAmount * 1 ether < wdiv(offerBuyAmount, offerSellAmount)) {
                break; // We consider that all amount is sold
            }

            // if sell amount >= offer buy amount then lets buy the whole offer
            if (sellAmount >= offerBuyAmount) {
                soldAmount_ = soldAmount_ + offerBuyAmount;
                boughtAmount_ = boughtAmount_ + offerSellAmount;
                sellAmount = sellAmount - offerBuyAmount;
            }
            // otherwise, let's just buy what we can
            else {
                soldAmount_ = soldAmount_ + sellAmount;
                boughtAmount_ = boughtAmount_ + ((sellAmount * offerSellAmount) / offerBuyAmount);
                sellAmount = 0;
            }

            // move to next best offer
            bestOfferId = dataUint256[__i(bestOfferId, "rankPrev")];
        }

        require(_sellAmount <= soldAmount_, "not enough orders in market");

        return boughtAmount_;
    }
}

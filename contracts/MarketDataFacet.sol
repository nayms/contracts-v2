pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/IMarketDataFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";
import "./MarketFacetBase.sol";

contract MarketDataFacet is EternalStorage, Controller, MarketFacetBase, IDiamondFacet, IMarketDataFacet {
  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IMarketDataFacet.setFee.selector,
      IMarketDataFacet.getConfig.selector,
      IMarketDataFacet.getBestOfferId.selector,
      IMarketDataFacet.getLastOfferId.selector,
      IMarketDataFacet.isActive.selector,
      IMarketDataFacet.getOffer.selector
    );
  }

  // IMarketDataFacet

  function getConfig() external view override returns (
    uint256 dust_,
    uint256 feeBP_
  ) {
    dust_ = dataUint256["dust"];
    feeBP_ = dataUint256["feeBP"];
  }

  function setFee(uint256 _feeBP) external override assertIsAdmin {
    dataUint256["feeBP"] = _feeBP;
  }

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
    return _getBestOfferId(_sellToken, _buyToken);
  }  
}

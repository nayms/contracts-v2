pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/IMarketConfigFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/Controller.sol";

contract MarketConfigFacet is EternalStorage, Controller, IDiamondFacet, IMarketConfigFacet {
  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) public {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IMarketConfigFacet.setFee.selector,
      IMarketConfigFacet.getConfig.selector
    );
  }

  // IMarketConfigFacet

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
}

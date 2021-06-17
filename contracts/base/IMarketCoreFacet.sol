pragma solidity 0.6.12;

interface IMarketCoreFacet {
  /**
   * Execute a limit offer.
   *
   * @return >0 if a limit offer was created on the market because the offer couldn't be totally fulfilled immediately. In this case the 
   * return value is the created offer's id.
   */
  function executeLimitOffer(address _sellToken, uint256 _sellAmount, address _buyToken, uint256 _buyAmount) external returns (uint256);
  function executeMarketOffer(address _sellToken, uint256 _sellAmount, address _buyToken) external;
  function cancel(uint256 _offerId) external;
  function getLastOfferId() external view returns (uint256);
  function isActive(uint256 _offerId) external view returns (bool);
  function getOffer(uint256 _offerId) external view returns ( 
    address creator_,
    address sellToken_, 
    uint256 sellAmount_, 
    address buyToken_, 
    uint256 buyAmount_,
    bool isActive_
  );
}

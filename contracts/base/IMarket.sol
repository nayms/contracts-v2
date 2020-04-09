pragma solidity >=0.5.8;

/**
 * @dev Matching market.
 *
 * Derived from https://github.com/nayms/maker-otc
 */
interface IMarket {
  /**
   * @dev Create an offer at a specific price-point.
   *
   * @param pay_amt Amount to sell.
   * @param pay_gem Asset to sell.
   * @param buy_amt Amount to buy.
   * @param buy_gem Asset to buy.
   * @param pos Position to insert offer in list.
   * @param rounding Whether the matching algorithm should round small numbers.
   */
  function offer(uint pay_amt, address pay_gem, uint buy_amt, address buy_gem, uint pos, bool rounding) external returns (uint);
  /**
   * @dev Partially buy an offer.
   *
   * @param id Offer id.
   * @param amount Amount to buy.
   */
  function buy(uint id, uint amount) external;
  /**
   * @dev Sell asset at best possible price.
   *
   * Note that this call only succeeds if `min_fill_amount` can be sold.
   *
   * @param pay_gem Asset to sell.
   * @param pay_amt Amount to sell.
   * @param buy_gem Asset to buy.
   * @param min_fill_amount Min. fill amount.
   */
  function sellAllAmount(address pay_gem, uint pay_amt, address buy_gem, uint min_fill_amount) external returns (uint);
  /**
   * @dev Cancel an offer.
   *
   * @param id Offer id.
   * @return true if successful.
   */
  function cancel(uint id) external returns (bool);
  /**
   * @dev Get id of latest offer.
   *
   * @return Latest offer id.
   */
  function last_offer_id() external view returns (uint);
  /**
   * @dev Check if offer is still active.
   *
   * @param id Offer id.
   * @return true if active, false otherwise.
   */
  function isActive(uint id) external view returns (bool);
  /**
   * @dev Get offer creator.
   *
   * @param id Offer id.
   * @return Address that created the offer.
   */
  function getOwner(uint id) external view returns (address);
  /**
   * @dev Get offer details.
   *
   * @param id Offer id.
   * @return (pay amount, pay token, buy amount, buy token)
   */
  function getOffer(uint id) external view returns (uint, address, uint, address);
}

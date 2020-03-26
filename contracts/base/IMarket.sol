pragma solidity >=0.5.8;

/**
 * Interface derived from MatchingMarket - https://github.com/nayms/maker-otc
 */
interface IMarket {
  function offer(uint pay_amt, address pay_gem, uint buy_amt, address buy_gem, uint pos, bool rounding) external returns (uint);
  function buy(uint id, uint amount) external;
  function sellAllAmount(address pay_gem, uint pay_amt, address buy_gem, uint min_fill_amount) external returns (uint);
  function cancel(uint id) external returns (bool);
  function last_offer_id() external view returns (uint);
  function isActive(uint id) external view returns (bool);
  function getOwner(uint id) external view returns (address);
  function getOffer(uint id) external view returns (uint, address, uint, address);
}

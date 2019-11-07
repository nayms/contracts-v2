pragma solidity >=0.5.8;

/**
 * Interface derived from MatchingMarket - https://github.com/nayms/maker-otc
 */
interface IMarket {
  function offer(uint pay_amt, address pay_gem, uint buy_amt, address buy_gem) external returns (uint);
}

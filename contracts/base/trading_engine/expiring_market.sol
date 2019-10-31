pragma solidity >=0.5.8;

import "./simple_market.sol";

// Simple Market with a market lifetime. When the close_time has been reached,
// offers can only be cancelled (offer and buy will throw).

contract ExpiringMarket is SimpleMarket {
    uint64 public close_time;

    // after close_time has been reached, no new offers are allowed
    modifier can_offer {
        require(!isClosed());
        _;
    }

    // after close, no new buys are allowed
    modifier can_buy(uint id) {
        require(isActive(id));
        require(!isClosed());
        _;
    }

    // after close, anyone can cancel an offer
    modifier can_cancel(uint id) {
        require(isActive(id));
        require((msg.sender == getOwner(id)) || isClosed());
        _;
    }

    function ExpiringMarket(uint64 _close_time)
        public
    {
        close_time = _close_time;
    }

    function isClosed() public view returns (bool closed) {
        return getTime() > close_time;
    }

    function getTime() public pure returns (uint64) {
        return uint64(now);
    }
}

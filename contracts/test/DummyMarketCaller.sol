// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/IMarket.sol";
import "../base/IERC20.sol";
import "../base/Parent.sol";
import "../base/Child.sol";

contract DummyParent is Parent {
    function addChild(address c) public {
        _addChild(c);
    }
}

contract DummyMarketCaller is Child, DummyParent {
    address private market;

    constructor(address _market, address _parent) {
        market = _market;
        _setParent(_parent);
    }

    function trade(
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken,
        uint256 _buyAmount,
        uint256 _feeSchedule
    ) external returns (uint256) {
        require(
            IERC20(_sellToken).approve(
                market,
                _sellAmount * 2 /* to allow for fees */
            ),
            "approval failed"
        );
        return IMarket(market).executeLimitOffer(_sellToken, _sellAmount, _buyToken, _buyAmount, _feeSchedule, address(0), "");
    }
}

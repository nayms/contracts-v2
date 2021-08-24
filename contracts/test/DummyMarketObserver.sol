pragma solidity 0.6.12;

import "../base/IMarketObserver.sol";
import "./IDummyMarketObserver.sol";

contract DummyMarketObserver is IMarketObserver, IDummyMarketObserver {
    // order id => "trade" or "closure"
    mapping(uint256 => ORDER_TYPE) private order;
    mapping(uint256 => bytes) private notifyData;

    function getOrder(uint256 orderId)
        external view override
        returns (ORDER_TYPE _type, bytes memory _data)
    {
        return (order[orderId], notifyData[orderId]);
    }

    function handleTrade(
        uint256 _offerId,
        address _sellToken,
        uint256 _soldAmount,
        address _buyToken,
        uint256 _boughtAmount,
        address _feeToken,
        uint256 _feeAmount,
        address _seller,
        address _buyer,
        bytes memory _data
    ) external override {
        order[_offerId] = ORDER_TYPE.TRADE;
        notifyData[_offerId] = _data;
        emit TRADE(_offerId);
    }

    function handleClosure(
        uint256 _offerId,
        address _sellToken,
        uint256 _unsoldAmount,
        address _buyToken,
        uint256 _unboughtAmount,
        address _seller,
        bytes memory _data
    ) external override {
        order[_offerId] = ORDER_TYPE.CLOSURE;
        notifyData[_offerId] = _data;
        emit CLOSURE(_offerId);
    }
}

pragma solidity 0.6.12;

import "./base/IMarketObserver.sol";
import "./base/IDummyMarketObserver.sol";

contract DummyMarketObserver is IMarketObserver, IDummyMarketObserver {
    // order id => "trade" or "closure"
    mapping(uint256 => ORDER_TYPE) private order;
    mapping(uint256 => bytes) private notifyData;

    /**
     * @dev Get order details.
     *
     * @param orderId The order id.
     * @return _type trade or closure.
     * @return _data passed optional data.
     */
    function getOrder(uint256 orderId)
        external view override
        returns (ORDER_TYPE _type, bytes memory _data)
    {
        return (order[orderId], notifyData[orderId]);
    }

    /**
     * @dev Handle a trade notification.
     *
     * @param _offerId Order id.
     * @param _sellToken Token sold.
     * @param _soldAmount Amount sold.
     * @param _buyToken Token bought.
     * @param _boughtAmount Amount bought.
     * @param _seller Order seller.
     * @param _buyer Order buyer.
     * @param _data Extra metadata that is being passed through.
     */
    function handleTrade(
        uint256 _offerId,
        address _sellToken,
        uint256 _soldAmount,
        address _buyToken,
        uint256 _boughtAmount,
        address _seller,
        address _buyer,
        bytes memory _data
    ) external override {
        order[_offerId] = ORDER_TYPE.TRADE;
        notifyData[_offerId] = _data;
    }

    /**
     * @dev Handle an order cancellation or closure.
     *
     * @param _offerId Order id.
     * @param _sellToken Token sold.
     * @param _unsoldAmount Amount remaining unsold.
     * @param _buyToken Token bought.
     * @param _unboughtAmount Amount remaining unbought.
     * @param _seller Order seller.
     * @param _data Extra metadata that is being passed through.
     */
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
    }
}

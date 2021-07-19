pragma solidity 0.6.12;

import "./base/IMarketObserver.sol";
import "./base/IDummyMarketObserver.sol";

contract DummyMarketObserver is IMarketObserver, IDummyMarketObserver {
    // order id => "trade" or "closure"
    mapping(uint256 => string) private order;

    /**
     * @dev Get order details.
     *
     * @param orderId The order id.
     */
    function getOrder(uint256 orderId)
        external override
        returns (string memory orderType)
    {
        orderType = order[orderId];
        return orderType;
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
    ) external override {}

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
    ) external override {}
}

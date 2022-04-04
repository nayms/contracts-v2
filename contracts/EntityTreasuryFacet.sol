// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./base/Controller.sol";
import "./base/EternalStorage.sol";
import "./EntityTreasuryFacetBase.sol";
import "./base/IPolicyTreasury.sol";
import "./base/IERC20.sol";
import "./base/IDiamondFacet.sol";

/**
 * @dev Business-logic for policy treasuries inside entities
 */
contract EntityTreasuryFacet is EternalStorage, Controller, EntityTreasuryFacetBase, IPolicyTreasury, IDiamondFacet {
    /**
     * Constructor
     */
    constructor(address _settings) Controller(_settings) {}

    // IDiamondFacet

    function getSelectors() public pure override returns (bytes memory) {
        return
            abi.encodePacked(
                IPolicyTreasury.getEconomics.selector,
                IPolicyTreasury.getPolicyEconomics.selector,
                IPolicyTreasury.getClaims.selector,
                IPolicyTreasury.getClaim.selector,
                IPolicyTreasury.createOrder.selector,
                IPolicyTreasury.cancelOrder.selector,
                IPolicyTreasury.payClaim.selector,
                IPolicyTreasury.incPolicyBalance.selector,
                IPolicyTreasury.setMinPolicyBalance.selector,
                IPolicyTreasury.resolveClaims.selector,
                IPolicyTreasury.isPolicyCollateralized.selector
            );
    }

    // IPolicyTreasury

    function getEconomics(address _unit)
        public
        view
        override
        returns (
            uint256 realBalance_,
            uint256 virtualBalance_,
            uint256 minBalance_
        )
    {
        realBalance_ = dataUint256[__a(_unit, "treasuryRealBalance")];
        virtualBalance_ = dataUint256[__a(_unit, "treasuryVirtualBalance")];
        minBalance_ = dataUint256[__a(_unit, "treasuryMinBalance")];
    }

    function getPolicyEconomics(address _policy)
        public
        view
        override
        returns (
            address unit_,
            uint256 balance_,
            uint256 minBalance_,
            uint256 claimsUnpaidTotalAmount_
        )
    {
        unit_ = _getPolicyUnit(_policy);
        balance_ = dataUint256[__a(_policy, "policyBalance")];
        minBalance_ = dataUint256[__a(_policy, "minPolicyBalance")];
        claimsUnpaidTotalAmount_ = dataUint256[__a(_policy, "policyClaimsUnpaidTotalAmount")];
    }

    function getClaims(address _unit)
        public
        view
        override
        returns (
            uint256 count_,
            uint256 unpaidCount_,
            uint256 unpaidTotalAmount_
        )
    {
        count_ = dataUint256[__a(_unit, "claimsCount")];
        unpaidCount_ = dataUint256[__a(_unit, "claimsUnpaidCount")];
        unpaidTotalAmount_ = dataUint256[__a(_unit, "claimsUnpaidTotalAmount")];
    }

    function getClaim(address _unit, uint256 _index)
        public
        view
        override
        returns (
            address policy_,
            address recipient_,
            uint256 amount_,
            bool paid_
        )
    {
        policy_ = dataAddress[__ia(_index, _unit, "claimPolicy")];
        recipient_ = dataAddress[__ia(_index, _unit, "claimRecipient")];
        amount_ = dataUint256[__ia(_index, _unit, "claimAmount")];
        paid_ = dataBool[__ia(_index, _unit, "claimPaid")];
    }

    function createOrder(
        bytes32 _type,
        address _sellUnit,
        uint256 _sellAmount,
        address _buyUnit,
        uint256 _buyAmount,
        uint256 _feeSchedule,
        address _notify,
        bytes calldata _notifyData
    ) external override assertIsMyPolicy(msg.sender) returns (uint256) {
        require(_type == ORDER_TYPE_TOKEN_BUYBACK || _type == ORDER_TYPE_TOKEN_SALE, "unknown order type");
        return _tradeOnMarket(_sellUnit, _sellAmount, _buyUnit, _buyAmount, _feeSchedule, _notify, _notifyData);
    }

    function cancelOrder(uint256 _orderId) public override assertIsMyPolicy(msg.sender) {
        IMarket mkt = _getMarket();
        if (mkt.isActive(_orderId)) {
            mkt.cancel(_orderId);
        }
    }

    function payClaim(address _recipient, uint256 _amount) public override assertIsMyPolicy(msg.sender) {
        // check and update treasury balances
        address unit = _getPolicyUnit(msg.sender);

        // check policy virtual balance
        require(dataUint256[__a(msg.sender, "policyBalance")] >= _amount, "exceeds policy balance");

        string memory trbKey = __a(unit, "treasuryRealBalance");

        if (dataUint256[trbKey] < _amount) {
            string memory cutaKey = __a(unit, "claimsUnpaidTotalAmount");
            dataUint256[cutaKey] = dataUint256[cutaKey] + _amount;

            string memory pcutaKey = __a(msg.sender, "policyClaimsUnpaidTotalAmount");
            dataUint256[pcutaKey] = dataUint256[pcutaKey] + _amount;

            dataUint256[__a(unit, "claimsCount")] += 1;
            dataUint256[__a(unit, "claimsUnpaidCount")] += 1;
            uint256 idx = dataUint256[__a(unit, "claimsCount")];

            dataAddress[__ia(idx, unit, "claimPolicy")] = msg.sender;
            dataAddress[__ia(idx, unit, "claimRecipient")] = _recipient;
            dataUint256[__ia(idx, unit, "claimAmount")] = _amount;
        } else {
            _decPolicyBalance(msg.sender, _amount);

            // payout!
            IERC20(unit).transfer(_recipient, _amount);
        }
    }

    function incPolicyBalance(uint256 _amount) public override assertIsMyPolicy(msg.sender) {
        _incPolicyBalance(msg.sender, _amount);
    }

    function setMinPolicyBalance(uint256 _bal) public override assertIsMyPolicy(msg.sender) {
        address unit = _getPolicyUnit(msg.sender);

        string memory key = __a(msg.sender, "minPolicyBalance");
        string memory tmbKey = __a(unit, "treasuryMinBalance");

        require(dataUint256[key] == 0, "already set");

        dataUint256[key] = _bal;
        dataUint256[tmbKey] = dataUint256[tmbKey] + _bal;

        emit SetMinPolicyBalance(msg.sender, _bal);
    }

    function resolveClaims(address _unit) public override {
        _resolveClaims(_unit);
    }

    function isPolicyCollateralized(address _policy) public view override returns (bool) {
        address unit = _getPolicyUnit(_policy);

        string memory pbKey = __a(_policy, "policyBalance");
        string memory pcutaKey = __a(_policy, "policyClaimsUnpaidTotalAmount");
        string memory trbKey = __a(unit, "treasuryRealBalance");

        // need no unpaid claims AND enough real balance
        return (dataUint256[pcutaKey] == 0) && (dataUint256[trbKey] >= dataUint256[pbKey]);
    }

    // Internal

    function _incPolicyBalance(address _policy, uint256 _amount) internal {
        address unit = _getPolicyUnit(_policy);

        string memory pbKey = __a(_policy, "policyBalance");
        string memory trbKey = __a(unit, "treasuryRealBalance");
        string memory tvbKey = __a(unit, "treasuryVirtualBalance");

        dataUint256[trbKey] = dataUint256[trbKey] + _amount;
        dataUint256[tvbKey] = dataUint256[tvbKey] + _amount;
        dataUint256[pbKey] = dataUint256[pbKey] + _amount;

        emit UpdatePolicyBalance(_policy, dataUint256[pbKey]);
    }
}

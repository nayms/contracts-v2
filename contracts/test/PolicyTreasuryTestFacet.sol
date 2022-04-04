// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/EternalStorage.sol";
import "../base/IDiamondFacet.sol";
import "../base/IMarketFeeSchedules.sol";
import "../PolicyFacetBase.sol";
import "../base/Controller.sol";

interface IPolicyTreasuryTestFacet is IDiamondFacet {
    function treasuryIncPolicyBalance(uint256 _amount) external;

    function treasurySetMinPolicyBalance(uint256 _amount) external;

    function treasuryPayClaim(address _recipient, uint256 _amount) external;

    function treasuryCreateOrder(
        bytes32 _type,
        address _sellUnit,
        uint256 _sellAmount,
        address _buyUnit,
        uint256 _buyAmount
    ) external;

    function treasuryCancelOrder(uint256 _orderId) external;
}

contract PolicyTreasuryTestFacet is EternalStorage, PolicyFacetBase, IPolicyTreasuryTestFacet, Controller, IMarketFeeSchedules {
    constructor(address _settings) Controller(_settings) {
        // nothing
    }

    function getSelectors() public pure override returns (bytes memory) {
        return
            abi.encodePacked(
                IPolicyTreasuryTestFacet.treasuryIncPolicyBalance.selector,
                IPolicyTreasuryTestFacet.treasurySetMinPolicyBalance.selector,
                IPolicyTreasuryTestFacet.treasuryPayClaim.selector,
                IPolicyTreasuryTestFacet.treasuryCreateOrder.selector,
                IPolicyTreasuryTestFacet.treasuryCancelOrder.selector
            );
    }

    function treasuryIncPolicyBalance(uint256 _amount) public override {
        _getTreasury().incPolicyBalance(_amount);
    }

    function treasurySetMinPolicyBalance(uint256 _amount) public override {
        _getTreasury().setMinPolicyBalance(_amount);
    }

    function treasuryPayClaim(address _recipient, uint256 _amount) public override {
        _getTreasury().payClaim(_recipient, _amount);
    }

    function treasuryCreateOrder(
        bytes32 _type,
        address _sellUnit,
        uint256 _sellAmount,
        address _buyUnit,
        uint256 _buyAmount
    ) public override {
        _getTreasury().createOrder(_type, _sellUnit, _sellAmount, _buyUnit, _buyAmount, FEE_SCHEDULE_STANDARD, address(0), "");
    }

    function treasuryCancelOrder(uint256 _orderId) public override {
        _getTreasury().cancelOrder(_orderId);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import { EntityFacetBase, IERC20 } from "./EntityFacetBase.sol";
import "./base/IEntitySimplePolicyCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import { SimplePolicy, Controller, AccessControl, ISimplePolicy } from "./SimplePolicy.sol";

contract EntitySimplePolicyCoreFacet is EntityFacetBase, IEntitySimplePolicyCoreFacet, IDiamondFacet {
    constructor(address _settings) Controller(_settings) {}

    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(IEntitySimplePolicyCoreFacet.createSimplePolicy.selector, IEntitySimplePolicyCoreFacet.updateAllowSimplePolicy.selector);
    }

    // IEntitySimplePolicyCoreFacet

    function _validateSimplePolicyCreation(address _unit, uint256 _limit) internal view {
        require(dataBool["allowSimplePolicy"], "creation disabled");

        uint256 collateralRatio = dataUint256[__a(_unit, "collateralRatio")];
        uint256 maxCapital = dataUint256[__a(_unit, "maxCapital")];
        require((collateralRatio > 0) && (maxCapital > 0), "currency disabled");

        uint256 newTotalLimit = dataUint256[__a(_unit, "totalLimit")] + _limit;
        require(maxCapital >= newTotalLimit, "max capital exceeded");

        uint256 balance = dataUint256[__a(_unit, "balance")];
        require(balance >= (newTotalLimit * collateralRatio) / 1000, "collateral ratio not met");
    }

    function createSimplePolicy(
        bytes32 _id,
        uint256 _startDate,
        uint256 _maturationDate,
        address _unit,
        uint256 _limit,
        SimplePolicy.Stakeholders calldata _stakeholders
    ) external override {
        _validateSimplePolicyCreation(_unit, _limit);
        dataUint256[__a(_unit, "totalLimit")] += _limit;

        SimplePolicy simplePolicy = new SimplePolicy(
            _id,
            dataUint256["numSimplePolicies"],
            address(settings()),
            msg.sender,
            _startDate,
            _maturationDate,
            _unit,
            _limit,
            _stakeholders
        );

        dataAddress[__i(dataUint256["numSimplePolicies"], "addressByNumber")] = address(simplePolicy);
        dataAddress[__b(_id, "addressById")] = address(simplePolicy);
        dataUint256["numSimplePolicies"] = dataUint256["numSimplePolicies"] + 1;
    }

    function updateAllowSimplePolicy(bool _allow) external override assertIsSystemManager(msg.sender) {
        dataBool["allowSimplePolicy"] = _allow;
    }
}

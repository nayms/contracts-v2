// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import { EntityFacetBase, IERC20 } from "./EntityFacetBase.sol";
import "./base/Controller.sol";
import "./base/IEntitySimplePolicyCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import { SimplePolicy, Stakeholders } from "./SimplePolicy.sol";
import "./base/ISimplePolicy.sol";

contract EntitySimplePolicyCoreFacet is EntityFacetBase, IEntitySimplePolicyCoreFacet, IDiamondFacet {
    constructor(address _settings) Controller(_settings) {}

    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(IEntitySimplePolicyCoreFacet.createSimplePolicy.selector, IEntitySimplePolicyCoreFacet.updateAllowSimplePolicy.selector);
    }

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
        Stakeholders memory _stakeholders
    ) external override assertIsEntityAdmin(msg.sender) {
        _validateSimplePolicyCreation(_unit, _limit);
        dataUint256[__a(_unit, "totalLimit")] += _limit;

        _stakeholders.stakeholdersAddresses[_stakeholders.roles.length] = address(this);

        // create policy
        SimplePolicy policy = new SimplePolicy(_id, dataUint256["numSimplePolicies"], address(settings()), msg.sender, _startDate, _maturationDate, _unit, _limit, _stakeholders);

        address policyAddress = address(policy);

        emit NewSimplePolicy(_id, policyAddress);

        _addChild(policyAddress);

        ISimplePolicy policyFacet = ISimplePolicy(policyAddress);
        policyFacet.approveSimplePolicy(_stakeholders.roles, _stakeholders.approvalSignatures);

        emit SimplePolicyApproved(_id, address(policy));

        dataAddress[__i(dataUint256["numSimplePolicies"], "addressByNumber")] = address(policy);
        dataAddress[__b(_id, "addressById")] = address(policy);
        dataUint256["numSimplePolicies"] = dataUint256["numSimplePolicies"] + 1;
    }

    function updateAllowSimplePolicy(bool _allow) external override assertIsSystemManager(msg.sender) {
        dataBool["allowSimplePolicy"] = _allow;
    }
}

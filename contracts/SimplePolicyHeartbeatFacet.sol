// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./SimplePolicyFacetBase.sol";
import "./base/ISimplePolicyHeartbeatFacet.sol";
import "./base/ISimplePolicyStates.sol";

contract SimplePolicyHeartbeatFacet is SimplePolicyFacetBase, ISimplePolicyHeartbeatFacet, ISimplePolicyStates, IDiamondFacet {
    constructor(address _settings) Controller(_settings) {
        // nothing to do here
    }

    function getSelectors() public pure override returns (bytes memory) {
        return abi.encodePacked(ISimplePolicyHeartbeatFacet.checkAndUpdateState.selector);
    }

    function checkAndUpdateState() external override returns (bool reduceTotalLimit_) {
        bytes32 id = dataBytes32["id"];
        uint256 state = dataUint256["state"];
        reduceTotalLimit_ = false;

        if (block.timestamp >= dataUint256["maturationDate"] && state < POLICY_STATE_MATURED) {
            // move state to matured
            dataUint256["state"] = POLICY_STATE_MATURED;

            reduceTotalLimit_ = true;

            // emit event
            emit SimplePolicyStateUpdated(id, POLICY_STATE_MATURED, msg.sender);
        } else if (block.timestamp >= dataUint256["startDate"] && state < POLICY_STATE_ACTIVE) {
            // move state to active
            dataUint256["state"] = POLICY_STATE_ACTIVE;

            // emit event
            emit SimplePolicyStateUpdated(id, POLICY_STATE_ACTIVE, msg.sender);
        }
    }
}

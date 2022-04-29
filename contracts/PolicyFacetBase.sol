// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;
import "./base/EternalStorage.sol";
import "./base/IPolicyStates.sol";
import "./base/IPolicyTreasury.sol";
import "./base/AccessControl.sol";

/**
 * @dev Policy facet base class
 */
abstract contract PolicyFacetBase is EternalStorage, IPolicyStates, AccessControl {
    function _setPolicyState(uint256 _newState) internal {
        if (dataUint256["state"] != _newState) {
            dataUint256["state"] = _newState;
            emit PolicyStateUpdated(_newState, msg.sender);
        }
    }

    function _setTrancheState(uint256 _trancheIndex, uint256 _newState) internal {
        if (dataUint256[__i(_trancheIndex, "state")] != _newState) {
            dataUint256[__i(_trancheIndex, "state")] = _newState;
            emit TrancheStateUpdated(_trancheIndex, _newState, msg.sender);
        }
    }

    function _getTreasury() internal view returns (IPolicyTreasury) {
        return IPolicyTreasury(dataAddress["treasury"]);
    }

    function _getNumberOfTranchePaymentsMissed(uint256 _index) internal view returns (uint256) {
        uint256 numPremiums = dataUint256[__i(_index, "numPremiums")];
        uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];

        uint256 expectedNumPremiumsPaid = 0;

        for (uint256 i = 0; numPremiums > i; i += 1) {
            uint256 dueAt = dataUint256[__ii(_index, i, "premiumDueAt")];

            if (dueAt <= block.timestamp) {
                expectedNumPremiumsPaid += 1;
            }
        }

        if (expectedNumPremiumsPaid >= numPremiumsPaid) {
            return expectedNumPremiumsPaid - numPremiumsPaid;
        } else {
            return 0;
        }
    }

    function _tranchePaymentsAllMade(uint256 _index) internal view returns (bool) {
        uint256 numPremiums = dataUint256[__i(_index, "numPremiums")];
        uint256 numPremiumsPaid = dataUint256[__i(_index, "numPremiumsPaid")];
        return (numPremiumsPaid == numPremiums);
    }
}

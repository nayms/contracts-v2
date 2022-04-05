// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

/******************************************************************************\
Forked from https://github.com/mudgen/Diamond/blob/master/contracts/DiamondStorageContract.sol
/******************************************************************************/

import "./EternalStorage.sol";

contract DiamondStorageBase is EternalStorage {
    struct DiamondStorage {
        // maps function selectors to the facets that execute the functions.
        // and maps the selectors to the slot in the selectorSlots array.
        // and maps the selectors to the position in the slot.
        // func selector => address facet, uint64 slotsIndex, uint64 slotIndex
        mapping(bytes4 => bytes32) facets;
        // array of slots of function selectors.
        // each slot holds 8 function selectors.
        mapping(uint256 => bytes32) selectorSlots;
        // uint128 numSelectorsInSlot, uint128 selectorSlotsLength
        // selectorSlotsLength is the number of 32-byte slots in selectorSlots.
        // selectorSlotLength is the number of selectors in the last slot of
        // selectorSlots.
        uint256 selectorSlotsLength;
        // tracking initialization state
        // we use this to know whether a call to diamondCut() is part of the initial
        // construction or a later "upgrade" call
        bool initialized;
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        // ds_slot = keccak256("diamond.standard.diamond.storage");
        assembly {
            ds.slot := 0xc8fcad8db84d3cc18b4c41d551ea0ee66dd599cde068d998e57d5e09332c131c
        }
    }
}

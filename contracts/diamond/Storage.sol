pragma solidity >=0.6.7;

/******************************************************************************\
Forked from https://github.com/mudgen/Diamond/blob/master/contracts/DiamondStorageContract.sol
/******************************************************************************/

import "../base/EternalStorage.sol";

contract Storage is EternalStorage {

    struct DiamondStorage {
        // owner of the contract
        address contractOwner;

        // maps function selectors to the facets that execute the functions.
        // and maps the selectors to the slot in the selectorSlots array.
        // and maps the selectors to the position in the slot.
        // func selector => address facet, uint64 slotsIndex, uint64 slotIndex
        mapping(bytes4 => bytes32) facets;

        // array of slots of function selectors.
        // each slot holds 8 function selectors.
        mapping(uint => bytes32) selectorSlots;

        // uint128 numSelectorsInSlot, uint128 selectorSlotsLength
        // selectorSlotsLength is the number of 32-byte slots in selectorSlots.
        // selectorSlotLength is the number of selectors in the last slot of
        // selectorSlots.
        uint selectorSlotsLength;
    }


    function diamondStorage() internal pure returns(DiamondStorage storage ds) {
        // ds_slot = keccak256("diamond.standard.diamond.storage");
        assembly { ds_slot := 0xc8fcad8db84d3cc18b4c41d551ea0ee66dd599cde068d998e57d5e09332c131c }
    }
}

pragma solidity >=0.6.7;
pragma experimental ABIEncoderV2;

/******************************************************************************\
Forked from https://github.com/mudgen/Diamond/blob/master/contracts/DiamondExample.sol
/******************************************************************************/

import "./Storage.sol";
import "./DiamondHeaders.sol";
import "./DiamondFacet.sol";
import "./DiamondLoupeFacet.sol";

contract DiamondExample is Storage {
    constructor() public {
        DiamondStorage storage ds = diamondStorage();
        ds.contractOwner = msg.sender;

        // Create a DiamondFacet contract which implements the Diamond interface
        DiamondFacet diamondFacet = new DiamondFacet();

        // Create a DiamondLoupeFacet contract which implements the Diamond Loupe interface
        DiamondLoupeFacet diamondLoupeFacet = new DiamondLoupeFacet();

        bytes[] memory diamondCut = new bytes[](2);

        // Adding cut function
        diamondCut[0] = abi.encodePacked(diamondFacet, Diamond.diamondCut.selector);

        // Adding diamond loupe functions
        diamondCut[1] = abi.encodePacked(
            diamondLoupeFacet,
            DiamondLoupe.facetFunctionSelectors.selector,
            DiamondLoupe.facets.selector,
            DiamondLoupe.facetAddress.selector,
            DiamondLoupe.facetAddresses.selector
        );

        // execute cut function
        bytes memory cutFunction = abi.encodeWithSelector(Diamond.diamondCut.selector, diamondCut);
        (bool success,) = address(diamondFacet).delegatecall(cutFunction);
        require(success, "Adding functions failed.");
    }

    // Finds facet for function that is called and executes the
    // function if it is found and returns any value.
    fallback() external payable {
        DiamondStorage storage ds = diamondStorage();
        address facet = address(bytes20(ds.facets[msg.sig]));
        require(facet != address(0), "Function does not exist.");
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), facet, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)
            switch result
            case 0 {revert(ptr, size)}
            default {return (ptr, size)}
        }
    }

    receive() external payable {
    }
}

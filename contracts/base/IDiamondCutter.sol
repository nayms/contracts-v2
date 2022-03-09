// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
pragma experimental ABIEncoderV2;

/******************************************************************************\
Forked from https://github.com/mudgen/Diamond/blob/master/contracts/DiamondHeaders.sol
/******************************************************************************/


interface IDiamondCutter {
    /// @notice _diamondCut is an array of bytes arrays.
    /// This argument is tightly packed for gas efficiency.
    /// That means no padding with zeros.
    /// Here is the structure of _diamondCut:
    /// _diamondCut = [
    ///     abi.encodePacked(facet, sel1, sel2, sel3, ...),
    ///     abi.encodePacked(facet, sel1, sel2, sel4, ...),
    ///     ...
    /// ]
    /// facet is the address of a facet
    /// sel1, sel2, sel3 etc. are four-byte function selectors.
    function diamondCut(bytes[] calldata _diamondCut) external;
    event DiamondCut(bytes[] _diamondCut);
}



pragma solidity >=0.5.8;

// @dev All ERC1820 implementers must implement this
// Based on https://raw.githubusercontent.com/0xjac/ERC1820/master/contracts/ERC1820ImplementerInterface.sol
contract ERC1820ImplementerInterface {
  bytes32 constant ERC1820_ACCEPT_MAGIC = keccak256(abi.encodePacked("ERC1820_ACCEPT_MAGIC"));

  function canImplementInterfaceForAddress(bytes32 /*interfaceHash*/, address /*addr*/) public pure returns(bytes32) {
    return ERC1820_ACCEPT_MAGIC;
  }
}

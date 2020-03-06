pragma solidity ^0.5.5;

/**
 * @dev Functions to aid with delegate calls
 */
library Delegate {
  function dsig (bytes memory _fnSig) internal pure returns (bytes4) {
    return bytes4(keccak256(_fnSig));
  }

  function dcall (address _e, bytes memory _data) internal returns (bytes memory) {
    (bool success, bytes memory returnedData) = _e.delegatecall(_data);
    require(success, string(returnedData));
    return returnedData;
  }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;


import "./DiamondProxy.sol";

/**
 * @dev Base class for a general proxy contract which uses a singleton delegate instance to resolve the correct diamond facet for a call.
 */
contract Proxy is DiamondProxy {
  function _setDelegateAddress(address _addr) internal {
    dataAddress["delegate"] = _addr;
  }

  function getDelegateAddress() external view returns (address) {
    return dataAddress["delegate"];
  }

  function resolveFacet (bytes4 _sig) public view override returns (address) {
    return DiamondProxy(payable(dataAddress["delegate"])).resolveFacet(_sig);
  }
}



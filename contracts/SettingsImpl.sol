pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/EternalStorage.sol";
import "./base/ISettingsImpl.sol";
import "./base/IProxyImpl.sol";

/**
 * @dev Business-logic for Entity
 */
 contract SettingsImpl is EternalStorage, AccessControl, ISettingsImpl, IProxyImpl {
  /**
   * Constructor
   */
  constructor (address _acl)
    AccessControl(_acl)
    public
  {}

  // IProxyImpl

  function getImplementationVersion () public pure returns (string memory) {
    return "v1";
  }

  // ISettingsImpl

  function setMatchingMarket(address _market) public assertIsAdmin {
    dataAddress["matchingMarket"] = _market;
  }

  function getMatchingMarket() public view returns (address) {
    return dataAddress["matchingMarket"];
  }

  function getTime() public view returns (uint256) {
    return now;
  }
}

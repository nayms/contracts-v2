pragma solidity >=0.5.8;

import "./base/AccessControl.sol";
import "./base/EternalStorage.sol";
import "./base/ISettings.sol";

/**
 * @dev Business-logic for Settings
 */
 contract Settings is EternalStorage, AccessControl, ISettings {

  modifier assertIsAuthorized (address _context) {
    if (_context == address(this)) {
      require(isAdmin(msg.sender), 'must be admin');
    } else {
      require(msg.sender == _context, 'must be settings context owner');
    }
    _;
  }

  /**
   * Constructor
   */
  constructor (address _acl) AccessControl(_acl) public {}

  // ISettings

  function getAddress(address _context, bytes32 _key) public view returns (address) {
    return dataAddress[__ab(_context, _key)];
  }

  function getAddress(bytes32 _key) public view returns (address) {
    return getAddress(address(this), _key);
  }

  function setAddress(address _context, bytes32 _key, address _value) public assertIsAuthorized(_context) {
    dataAddress[__ab(_context, _key)] = _value;
  }

  function getBool(address _context, bytes32 _key) public view returns (bool) {
    return dataBool[__ab(_context, _key)];
  }

  function getBool(bytes32 _key) public view returns (bool) {
    return getBool(address(this), _key);
  }

  function setBool(address _context, bytes32 _key, bool _value) public assertIsAuthorized(_context) {
    dataBool[__ab(_context, _key)] = _value;
  }

  function getUint256(address _context, bytes32 _key) public view returns (uint256) {
    return dataUint256[__ab(_context, _key)];
  }

  function getUint256(bytes32 _key) public view returns (uint256) {
    return getUint256(address(this), _key);
  }

  function setUint256(address _context, bytes32 _key, uint256 _value) public assertIsAuthorized(_context) {
    dataUint256[__ab(_context, _key)] = _value;
  }

  function getString(address _context, bytes32 _key) public view returns (string memory) {
    return dataString[__ab(_context, _key)];
  }

  function getString(bytes32 _key) public view returns (string memory) {
    return getString(address(this), _key);
  }

  function setString(address _context, bytes32 _key, string memory _value) public assertIsAuthorized(_context) {
    dataString[__ab(_context, _key)] = _value;
  }

  function getTime() public view returns (uint256) {
    return now;
  }
}

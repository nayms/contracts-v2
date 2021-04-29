pragma solidity 0.6.12;

import "./base/EternalStorage.sol";
import "./base/ISettings.sol";
import "./base/IACL.sol";

/**
 * @dev Business-logic for Settings
 */
 contract Settings is EternalStorage, ISettings {

  modifier assertIsAuthorized (address _context) {
    if (_context == address(this)) {
      require(acl().isAdmin(msg.sender), 'must be admin');
    } else {
      require(msg.sender == _context, 'must be context owner');
    }
    _;
  }

  /**
   * Constructor
   * @param _acl ACL address.
   */
  constructor (address _acl) public {
    dataAddress["acl"] = _acl;
  }

  // ISettings

  function acl() public view override returns (IACL) {
    return IACL(dataAddress["acl"]);
  }

  function getAddress(address _context, bytes32 _key) public view override returns (address) {
    return dataAddress[__ab(_context, _key)];
  }

  function getRootAddress(bytes32 _key) public view override returns (address) {
    return getAddress(address(this), _key);
  }

  function setAddress(address _context, bytes32 _key, address _value) public override assertIsAuthorized(_context) {
    dataAddress[__ab(_context, _key)] = _value;
    emit SettingChanged(_context, _key, msg.sender, 'address');
  }

  function getAddresses(address _context, bytes32 _key) public view override returns (address[] memory) {
    return dataManyAddresses[__ab(_context, _key)];
  }

  function getRootAddresses(bytes32 _key) public view override returns (address[] memory) {
    return getAddresses(address(this), _key);
  }

  function setAddresses(address _context, bytes32 _key, address[] memory _value) public override assertIsAuthorized(_context) {
    dataManyAddresses[__ab(_context, _key)] = _value;
    emit SettingChanged(_context, _key, msg.sender, 'addresses');
  }

  function getBool(address _context, bytes32 _key) public view override returns (bool) {
    return dataBool[__ab(_context, _key)];
  }

  function getRootBool(bytes32 _key) public view override returns (bool) {
    return getBool(address(this), _key);
  }

  function setBool(address _context, bytes32 _key, bool _value) public override assertIsAuthorized(_context) {
    dataBool[__ab(_context, _key)] = _value;
    emit SettingChanged(_context, _key, msg.sender, 'bool');
  }

  function getUint256(address _context, bytes32 _key) public view override returns (uint256) {
    return dataUint256[__ab(_context, _key)];
  }

  function getRootUint256(bytes32 _key) public view override returns (uint256) {
    return getUint256(address(this), _key);
  }

  function setUint256(address _context, bytes32 _key, uint256 _value) public override assertIsAuthorized(_context) {
    dataUint256[__ab(_context, _key)] = _value;
    emit SettingChanged(_context, _key, msg.sender, 'uint256');
  }

  function getString(address _context, bytes32 _key) public view override returns (string memory) {
    return dataString[__ab(_context, _key)];
  }

  function getRootString(bytes32 _key) public view override returns (string memory) {
    return getString(address(this), _key);
  }

  function setString(address _context, bytes32 _key, string memory _value) public override assertIsAuthorized(_context) {
    dataString[__ab(_context, _key)] = _value;
    emit SettingChanged(_context, _key, msg.sender, 'string');
  }

  function getTime() public view override returns (uint256) {
    return block.timestamp;
  }
}

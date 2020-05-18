pragma solidity >=0.6.7;

import "./ISettingsKeys.sol";

/**
 * @dev Settings.
 */
abstract contract ISettings is ISettingsKeys {
  /**
   * @dev Get an address.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getAddress(address _context, bytes32 _key) public view virtual returns (address);

  /**
   * @dev Get an address in the root context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getRootAddress(bytes32 _key) public view virtual returns (address);

  /**
   * @dev Set an address.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setAddress(address _context, bytes32 _key, address _value) public virtual;

  /**
   * @dev Get an address.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getAddresses(address _context, bytes32 _key) public view virtual returns (address[] memory);

  /**
   * @dev Get an address in the root context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getRootAddresses(bytes32 _key) public view virtual returns (address[] memory);

  /**
   * @dev Set an address.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setAddresses(address _context, bytes32 _key, address[] memory _value) public virtual;

  /**
   * @dev Get a boolean.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getBool(address _context, bytes32 _key) public view virtual returns (bool);

  /**
   * @dev Get a boolean in the root context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getRootBool(bytes32 _key) public view virtual returns (bool);

  /**
   * @dev Set a boolean.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setBool(address _context, bytes32 _key, bool _value) public virtual;

  /**
   * @dev Get a number.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getUint256(address _context, bytes32 _key) public view virtual returns (uint256);

  /**
   * @dev Get a number in the root context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getRootUint256(bytes32 _key) public view virtual returns (uint256);

  /**
   * @dev Set a number.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setUint256(address _context, bytes32 _key, uint256 _value) public virtual;

  /**
   * @dev Get a string.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getString(address _context, bytes32 _key) public view virtual returns (string memory);

  /**
   * @dev Get a string in the root context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getRootString(bytes32 _key) public view virtual returns (string memory);

  /**
   * @dev Set a string.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setString(address _context, bytes32 _key, string memory _value) public virtual;


  /**
   * @dev Get current block time.
   *
   * @return Block time.
   */
  function getTime() external view virtual returns (uint256);


  // events

  /**
   * @dev Emitted when a setting gets updated.
   * @param context The context.
   * @param key The key.
   * @param caller The caller.
   * @param keyType The type of setting which changed.
   */
  event SettingChanged (address indexed context, bytes32 indexed key, address indexed caller, string keyType);
}

pragma solidity >=0.5.8;

import "./ISettingsKeys.sol";

/**
 * @dev Settings.
 */
contract ISettings is ISettingsKeys {
  /**
   * @dev Get an address.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getAddress(address _context, bytes32 _key) public view returns (address);

  /**
   * @dev Get an address in the system context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getAddress(bytes32 _key) public view returns (address);

  /**
   * @dev Set an address.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setAddress(address _context, bytes32 _key, address _value) public;

  /**
   * @dev Get a boolean.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getBool(address _context, bytes32 _key) public view returns (bool);

  /**
   * @dev Get a boolean in the system context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getBool(bytes32 _key) public view returns (bool);

  /**
   * @dev Set a boolean.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setBool(address _context, bytes32 _key, bool _value) public;

  /**
   * @dev Get a number.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getUint256(address _context, bytes32 _key) public view returns (uint256);

  /**
   * @dev Get a number in the system context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getUint256(bytes32 _key) public view returns (uint256);

  /**
   * @dev Set a number.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setUint256(address _context, bytes32 _key, uint256 _value) public;

  /**
   * @dev Get a string.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getString(address _context, bytes32 _key) public view returns (string memory);

  /**
   * @dev Get a string in the system context.
   *
   * @param _key The key.
   *
   * @return The value.
   */
  function getString(bytes32 _key) public view returns (string memory);

  /**
   * @dev Set a string.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setString(address _context, bytes32 _key, string memory _value) public;


  /**
   * @dev Get current block time.
   *
   * @return Block time.
   */
  function getTime() external view returns (uint256);
}

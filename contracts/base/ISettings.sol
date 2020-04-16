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
  function getAddress(bytes32 _context, bytes32 _key) public returns (address);

  /**
   * @dev Set an address.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setAddress(bytes32 _context, bytes32 _key, address _value) public;

  /**
   * @dev Get a boolean.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getBool(bytes32 _context, bytes32 _key) public returns (address);

  /**
   * @dev Set a boolean.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setBool(bytes32 _context, bytes32 _key, bool _value) public;

  /**
   * @dev Get a number.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getUint256(bytes32 _context, bytes32 _key) public returns (address);

  /**
   * @dev Set an number.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setUint256(bytes32 _context, bytes32 _key, uint256 _value) public;

  /**
   * @dev Get a string.
   *
   * @param _context The context.
   * @param _key The key.
   *
   * @return The value.
   */
  function getString(bytes32 _context, bytes32 _key) public returns (string memory);

  /**
   * @dev Set a string.
   *
   * @param _context The context.
   * @param _key The key.
   * @param _value The value.
   */
  function setString(bytes32 _context, bytes32 _key, string memory _value) public;


  /**
   * @dev Get current block time.
   *
   * @return Block time.
   */
  function getTime() external view returns (uint256);
}

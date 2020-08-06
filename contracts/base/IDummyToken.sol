pragma solidity >=0.6.7;

import "./IERC20.sol";

/**
 * @dev Super-interface for dummy token
 */
abstract contract IDummyToken is IERC20 {
  /**
   * @dev Mint tokens.
   *
   * @param _amount The amount to mint (in satoshis).
   */
  function mint(uint256 _amount) external virtual;

  /**
   * @dev Emitted when ETH is deposited and tokens are minted.
   * @param sender The account.
   * @param amount The amount minted.
   */
  event Mint(address indexed sender, uint amount);
}

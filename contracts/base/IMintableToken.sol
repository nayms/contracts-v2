pragma solidity >=0.6.7;

import "./IERC20.sol";

/**
 * @dev Super-interface for mintable token
 */
abstract contract IMintableToken is IERC20 {
  /**
   * @dev Mint tokens.
   *
   * @param _amount The amount to mint (in satoshis).
   */
  function mint(uint256 _amount) external virtual;

  /**
   * @dev Emitted when tokens are minted.
   * @param minter The minter account.
   * @param amount The amount minted.
   */
  event Mint(address indexed minter, uint amount);
}

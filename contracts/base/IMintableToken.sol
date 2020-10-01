pragma solidity >=0.6.7;

import "./IERC20.sol";

/**
 * @dev Super-interface for mintable token
 */
abstract contract IMintableToken is IERC20 {
  /**
   * @dev Mint tokens.
   *
   * @param _amount The amount to mint.
   */
  function mint(uint256 _amount) external virtual;

  /**
   * @dev Burn tokens.
   *
   * @param _owner Whose balance to burn from.
   * @param _amount The amount to burn.
   */
  function burn(address _owner, uint256 _amount) external virtual;

  /**
   * @dev Emitted when tokens are minted.
   * @param minter The minter account.
   * @param amount The amount minted.
   */
  event Mint(address indexed minter, uint256 indexed amount);

  /**
   * @dev Emitted when tokens are burned.
   * @param burner The burner account.
   * @param owner The owner account.
   * @param amount The amount burned.
   */
  event Burn(address indexed burner, address indexed owner, uint256 indexed amount);
}

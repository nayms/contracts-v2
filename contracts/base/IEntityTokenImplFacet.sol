pragma solidity >=0.6.7;

/**
 * @dev Entity token implementation
 */
interface IEntityTokenImplFacet {
  // ERC-20 queries
  function tknName(address _asset) external view returns (string memory);
  function tknSymbol(address _asset) external view returns (string memory);
  function tknTotalSupply(address _asset) external view returns (uint256);
  function tknBalanceOf(address _asset, address _owner) external view returns (uint256);
  function tknAllowance(address _asset, address _spender, address _owner) external view returns (uint256);
  // ERC-20 mutations
  function tknApprove(address _asset, address _spender, address _from, uint256 _value) external;
  function tknTransfer(address _asset, address _operator, address _from, address _to, uint256 _value) external;
  function tknMint(address _asset, address _minter, address _owner, uint256 _value) external;
  function tknBurn(address _asset, address _burner, address _owner, uint256 _value) external;
}

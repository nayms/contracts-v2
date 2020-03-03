pragma solidity >=0.5.8;

/**
 * Implements logic for tranch token
 */
interface ITranchTokenHelper {
  // ERC-20 queries
  function tknName(uint256 _index) external view returns (string memory);
  function tknSymbol(uint256 _index) external view returns (string memory);
  function tknTotalSupply(uint256 _index) external view returns (uint256);
  function tknBalanceOf(uint256 _index, address _owner) external view returns (uint256);
  function tknAllowance(uint256 _index, address _spender, address _owner) external view returns (uint256);
  // ERC-20 mutations
  function tknApprove(uint256 _index, address _spender, address _from, uint256 _value) external;
  function tknTransfer(uint256 _index, address _operator, address _from, address _to, uint256 _value) external;
}

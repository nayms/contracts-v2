pragma solidity >=0.5.8;

/**
 * Implements logic for token standards: ERC20, ERC777
 */
interface ITranchToken {
  // ERC-20 and ERC-777 queries
  function tknName(uint256 _index) external view returns (string memory);
  function tknSymbol(uint256 _index) external view returns (string memory);
  function tknTotalSupply(uint256 _index) external view returns (uint256);
  function tknBalanceOf(uint256 _index, address _owner) external view returns (uint256);
  function tknAllowance(uint256 _index, address _spender, address _owner) external view returns (uint256);
  function tknIsOperatorFor(uint256 _index, address _operator, address _tokenHolder) external view returns (bool);
  // ERC-20 mutations
  function tknApprove(uint256 _index, address _spender, address _from, uint256 _value) external;
  function tknTransfer(uint256 _index, address _from, address _to, uint256 _value) external;
  function tknTransferFrom(uint256 _index, address _spender, address _from, address _to, uint256 _value) external;
  // ERC-777 mutations
  function tknAuthorizeOperator(uint256 _index, address _operator, address _tokenHolder) external;
  function tknRevokeOperator(uint256 _index, address _operator, address _tokenHolder) external;
  function tknSend(uint256 _index, address _from, address _to, uint256 _amount, bytes calldata _data) external;
  function tknOperatorSend(
    uint256 _index,
    address _operator,
    address _from,
    address _to,
    uint256 _amount,
    bytes calldata _data,
    bytes calldata _operatorData
  ) external;
}

pragma solidity >=0.5.8;

/**
 * To support token standards: ERC20, ERC777
 */
contract TranchTokenImpl {
  // ERC-20 and ERC-777 queries
  function tknName(uint256 _index) public view returns (string memory);
  function tknSymbol(uint256 _index) public view returns (string memory);
  function tknTotalSupply(uint256 _index) public view returns (uint256);
  function tknBalanceOf(uint256 _index, address _owner) public view returns (uint256);
  function tknAllowance(uint256 _index, address _owner, address _spender) public view returns (uint256);
  function isOperatorFor(address _operator, address _tokenHolder) public view returns (bool);
  // ERC-20 mutations
  function tknApprove(uint256 _index, address _caller, address _spender, uint256 _value) public;
  function tknTransfer(uint256 _index, address _caller, address _to, uint256 _value) public;
  function tknTransferFrom(uint256 _index, address _caller, address _from, address _to, uint256 _value) public;
  // ERC-777 mutations
  function tknAuthorizeOperator(uint256 _index, address _tokenHolder, address _operator) public;
  function tknRevokeOperator(uint256 _index, address _tokenHolder, address _operator) public;
}

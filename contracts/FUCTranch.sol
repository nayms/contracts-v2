pragma solidity >=0.5.8;

import './base/Address.sol';
import './base/IERC20.sol';
import './base/IERC777.sol';
import './base/IERC777Sender.sol';
import './base/IERC777Recipient.sol';
import './base/IERC1820Registry.sol';
import './base/TranchTokenImpl.sol';

/**
 * @dev An FUC tranch.
 */
contract FUCTranch is IERC20, IERC777 {
  using Address for address;

  TranchTokenImpl public impl;
  uint256 public index;

  /*
    Following ERC-1820 stuff is from:
    - https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC777/ERC777.sol
    - https://eips.ethereum.org/EIPS/eip-1820
   */
  IERC1820Registry private erc1820Registry = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
  // keccak256("ERC777TokensSender")
  bytes32 constant private TOKENS_SENDER_INTERFACE_HASH =
      0x29ddb589b1fb5fc7cf394961c1adf5f8c6454761adf795e67fe149f658abe895;
  // keccak256("ERC777TokensRecipient")
  bytes32 constant private TOKENS_RECIPIENT_INTERFACE_HASH =
      0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

  constructor (address _impl, uint256 _index) public {
    impl = TranchTokenImpl(_impl);
    index = _index;
  }

  // ERC-20 and ERC-777 queries //

  function name() public view returns (string memory) {
    return impl.tknName(index);
  }

  function symbol() public view returns (string memory) {
    return impl.tknSymbol(index);
  }

  function totalSupply() public view returns (uint256) {
    return impl.tknTotalSupply(index);
  }

  function balanceOf(address owner) public view returns (uint256) {
    return impl.tknBalanceOf(index, owner);
  }

  function granularity() public view returns (uint256) {
    return 1;
  }

  function decimals() public view returns (uint8) {
    return 18;
  }

  function allowance(address owner, address spender) public view returns (uint256) {
    return impl.tknAllowance(index, owner, spender);
  }

  function isOperatorFor(address operator, address tokenHolder) public view returns (bool) {
    return impl.tknIsOperatorFor(operator, tokenHolder);
  }

  function defaultOperators() public view returns (address[] memory) {
    return [];
  }

  // ERC-20 mutations //

  function approve(address spender, uint256 value) public returns (bool) {
    impl.tknApprove(index, msg.sender, spender, value);
    Approval(msg.sender, spender, value);
    return true;
  }

  function transfer(address to, uint256 value) public returns (bool) {
    impl.tknTransfer(index, msg.sender, to, value);
    _emitTransferEvents(msg.sender, msg.sender, to, value, "", "");
    return true;
  }

  function transferFrom(address from, address to, uint256 value) public returns (bool) {
    impl.tknTransferFrom(index, msg.sender, from, to, value);
    _emitTransferEvents(msg.sender, msg.sender, to, value, "", "");
    return true;
  }

  // ERC-777 mutations //

  function authorizeOperator(address operator) public {
    impl.tknAuthorizeOperator(index, msg.sender, operator);
    AuthorizedOperator(operator, msg.sender);
  }

  function revokeOperator(address operator) public {
    impl.tknRevokeOperator(index, msg.sender, operator);
    RevokedOperator(operator, msg.sender);
  }

  function send(address recipient, uint256 amount, bytes memory data) public {
    require(recipient != address(0), 'ERC777: cannot send to zero address');

    _callTokensToSend(msg.sender, msg.sender, recipient, amount, data, "");

    impl.tknSend(index, msg.sender, recipient, amount, data);

    _callTokensReceived(msg.sender, msg.sender, recipient, amount, data, "");

    _emitTransferEvents(msg.sender, msg.sender, recipient, amount, "", "");
  }

  function operatorSend(
      address sender,
      address recipient,
      uint256 amount,
      bytes calldata data,
      bytes calldata operatorData
  ) public {

  }

  // Private helper methods

  function _emitTransferEvents(
      address operator,
      address from,
      address to,
      uint256 amount,
      bytes memory userData,
      bytes memory operatorData
  )
      private
  {
    Sent(operator, from, to, amount, userData, operatorData);
    Transfer(from, to, amount);
  }

  /* From https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC777/ERC777.sol */

  function _callTokensToSend(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes memory userData,
    bytes memory operatorData
  )
      private
  {
    address implementer = erc1820Registry.getInterfaceImplementer(from, TOKENS_SENDER_INTERFACE_HASH);
    if (implementer != address(0)) {
      IERC777Sender(implementer).tokensToSend(operator, from, to, amount, userData, operatorData);
    }
  }

  function _callTokensReceived(
    address operator,
    address from,
    address to,
    uint256 amount,
    bytes memory userData,
    bytes memory operatorData
  )
      private
  {
    address implementer = erc1820Registry.getInterfaceImplementer(to, TOKENS_RECIPIENT_INTERFACE_HASH);
    if (implementer != address(0)) {
      IERC777Recipient(implementer).tokensReceived(operator, from, to, amount, userData, operatorData);
    } else {
      require(!to.isContract(), "ERC777: token recipient contract has no implementer for ERC777TokensRecipient");
    }
  }
}

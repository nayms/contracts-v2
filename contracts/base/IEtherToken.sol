pragma solidity >=0.5.8;

interface IEtherToken {
  // From: https://github.com/gnosis/util-contracts/blob/master/contracts/EtherToken.sol

  function setAllowedTransferOperator(address transferOperator, bool status) external;
  function deposit() external payable;
  function withdraw(uint value) external;

  event Deposit(address indexed sender, uint value);
  event Withdrawal(address indexed receiver, uint value);
}

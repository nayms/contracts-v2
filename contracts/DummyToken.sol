// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./base/IDummyToken.sol";
import "./base/PlatformToken.sol";
import "./base/SafeMath.sol";

contract DummyToken is IDummyToken, PlatformToken {
  using SafeMath for *;

  mapping (address => uint256) private balances;
  mapping (address => mapping (address => uint256)) private allowances;
  string public override name;
  string public override symbol;
  uint8 public override decimals;
  uint256 public override totalSupply;

  constructor (string memory _name, string memory _symbol, uint8 _decimals, uint256 _initialSupply, bool _isPlatformToken) public {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    totalSupply = _initialSupply;
    balances[msg.sender] = _initialSupply;
    isPlatformToken = _isPlatformToken;
  }

  function balanceOf(address account) public view override returns (uint256) {
      return balances[account];
  }

  function transfer(address recipient, uint256 amount) public override returns (bool) {
      _transfer(msg.sender, recipient, amount);
      return true;
  }

  function allowance(address owner, address spender) public view override returns (uint256) {
      return allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public override returns (bool) {
      _approve(msg.sender, spender, amount);
      return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
      _approve(sender, msg.sender, allowances[sender][msg.sender].sub(amount, "DummyToken: transfer amount exceeds allowance"));
      _transfer(sender, recipient, amount);
      return true;
  }

  function _transfer(address sender, address recipient, uint256 amount) internal {
      require(recipient != address(0), "DummyToken: transfer to the zero address");

      balances[sender] = balances[sender].sub(amount, "DummyToken: transfer amount exceeds balance");
      balances[recipient] = balances[recipient].add(amount);
      emit Transfer(sender, recipient, amount);
  }

  function _approve(address owner, address spender, uint256 amount) internal {
      require(spender != address(0), "DummyToken: approve to the zero address");

      allowances[owner][spender] = amount;
      emit Approval(owner, spender, amount);
  }

  // IDummyToken

  function deposit() public payable override {
      balances[msg.sender] = balances[msg.sender].add(msg.value);
      totalSupply = totalSupply.add(msg.value);
      emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint value) public override {
      // Balance covers value
      balances[msg.sender] = balances[msg.sender].sub(value, 'DummyToken: insufficient balance');
      totalSupply = totalSupply.sub(value);
      msg.sender.transfer(value);
      emit Withdrawal(msg.sender, value);
  }
}

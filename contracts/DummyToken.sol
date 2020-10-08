pragma solidity >=0.6.7;

import "./base/IMintableToken.sol";
import "./base/SafeMath.sol";

contract DummyToken is IMintableToken {
  using SafeMath for *;

  mapping (address => uint256) private balances;
  mapping (address => mapping (address => uint256)) private allowances;
  string public override name;
  string public override symbol;
  uint8 public override decimals;
  uint256 public override totalSupply;

  constructor (string memory _name, string memory _symbol, uint8 _decimals, uint256 _initialSupply) public {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    totalSupply = _initialSupply;
    balances[msg.sender] = _initialSupply;
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

  function mint(address _owner, uint256 _amount) public override {
      balances[_owner] = balances[_owner].add(_amount);
      totalSupply = totalSupply.add(_amount);
      emit Mint(msg.sender, _owner, _amount);
  }

  function burn(address _owner, uint256 _amount) public override {
      balances[_owner] = balances[_owner].sub(_amount);
      totalSupply = totalSupply.sub(_amount);
      emit Burn(msg.sender, _owner, _amount);
  }
}

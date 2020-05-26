pragma solidity >=0.6.7;

import "./base/IEtherToken.sol";
import "./base/SafeMath.sol";
import "./base/Controller.sol";

/**
 * Represents Wrapped ETH, see https://blog.0xproject.com/canonical-weth-a9aa7d0279dd
 */
contract EtherToken is Controller, IEtherToken {
  using SafeMath for *;

  mapping (address => uint256) private balances;
  mapping (address => mapping (address => uint256)) private allowances;
  string public constant override name = "Nayms Wrapped Ether";
  string public constant override symbol = "NAYMS_ETH";
  uint8 public constant override decimals = 18;
  uint256 public override totalSupply;

  constructor (address _acl, address _settings) Controller(_acl, _settings) public {
    // nothing needed
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
      _approve(sender, msg.sender, allowances[sender][msg.sender].sub(amount, "EtherToken: transfer amount exceeds allowance"));
      _transfer(sender, recipient, amount);
      return true;
  }

  function _transfer(address sender, address recipient, uint256 amount) internal {
      require(recipient != address(0), "EtherToken: transfer to the zero address");

      balances[sender] = balances[sender].sub(amount, "EtherToken: transfer amount exceeds balance");
      balances[recipient] = balances[recipient].add(amount);
      emit Transfer(sender, recipient, amount);
  }

  function _approve(address owner, address spender, uint256 amount) internal {
      require(spender != address(0), "EtherToken: approve to the zero address");

      allowances[owner][spender] = amount;
      emit Approval(owner, spender, amount);
  }

  // IEtherToken

  function deposit() public payable override {
      balances[msg.sender] = balances[msg.sender].add(msg.value);
      totalSupply = totalSupply.add(msg.value);
      emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint value) public override {
      // Balance covers value
      balances[msg.sender] = balances[msg.sender].sub(value, 'EtherToken: insufficient balance');
      totalSupply = totalSupply.sub(value);
      msg.sender.transfer(value);
      emit Withdrawal(msg.sender, value);
  }
}
